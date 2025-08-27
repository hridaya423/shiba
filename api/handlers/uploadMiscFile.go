package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"shiba-api/structs"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// Allowed file extensions for misc file uploads
var allowedExtensions = map[string]bool{
	".png": true,
	".jpg": true,
	".jpeg": true,
	".mp4": true,
	".gif": true,
	".mov": true,
	".mp3": true,
}

func UploadMiscFileHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse multipart form with 50MB max size
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "Missing file field 'file': "+err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Validate file extension
		ext := strings.ToLower(filepath.Ext(header.Filename))
		if !allowedExtensions[ext] {
			http.Error(w, "File type not allowed. Allowed types: png, jpg, jpeg, mp4, gif, mov, mp3", http.StatusBadRequest)
			return
		}

		// Generate unique filename
		id, err := uuid.NewV7()
		if err != nil {
			log.Printf("Failed to generate UUID: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Create filename with original extension
		filename := id.String() + ext
		key := "misc-files/" + filename

		// Read file content
		fileContent, err := io.ReadAll(file)
		if err != nil {
			log.Printf("Failed to read file content: %v", err)
			http.Error(w, "Failed to read file content", http.StatusInternalServerError)
			return
		}

		// Determine content type based on extension
		contentType := getContentType(ext)

		// Get bucket name from environment
		bucket := os.Getenv("R2_BUCKET")
		if bucket == "" {
			bucket = "shiba-arcade" // fallback
		}

		// Upload to R2
		log.Printf("Uploading file to R2: bucket=%s, key=%s, size=%d bytes", bucket, key, len(fileContent))
		_, err = srv.S3Client.PutObject(context.Background(), &s3.PutObjectInput{
			Bucket:      aws.String(bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader(fileContent),
			ContentType: aws.String(contentType),
		})

		if err != nil {
			log.Printf("Failed to upload file to R2: %v", err)
			http.Error(w, "Failed to upload file", http.StatusInternalServerError)
			return
		}
		log.Printf("Successfully uploaded file to R2: %s", key)

		// Generate URL pointing to our API endpoint
		url := fmt.Sprintf("https://tc8ckgo4kskk48s0o8cwc0g8.a.selfhosted.hackclub.com/misc-file/%s", id.String())

		// Return response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		resp := struct {
			Ok      bool   `json:"ok"`
			URL     string `json:"url"`
			FileID  string `json:"fileId"`
			Message string `json:"message"`
		}{
			Ok:      true,
			URL:     url,
			FileID:  id.String(),
			Message: "File uploaded successfully",
		}

		responseBytes, err := json.Marshal(resp)
		if err != nil {
			log.Printf("Failed to marshal response: %v", err)
			http.Error(w, "Failed to create response", http.StatusInternalServerError)
			return
		}

		if _, err := w.Write(responseBytes); err != nil {
			log.Printf("Failed to write response: %v", err)
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}

		log.Printf("Misc file uploaded successfully: %s", filename)
	}
}

func getContentType(ext string) string {
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".mp4":
		return "video/mp4"
	case ".gif":
		return "image/gif"
	case ".mov":
		return "video/quicktime"
	case ".mp3":
		return "audio/mpeg"
	default:
		return "application/octet-stream"
	}
}
