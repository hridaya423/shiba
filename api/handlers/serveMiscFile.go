package handlers

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"shiba-api/structs"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
)

func ServeMiscFileHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fileId := chi.URLParam(r, "fileId")
		if fileId == "" {
			http.Error(w, "File ID is required", http.StatusBadRequest)
			return
		}
		
		// Extract file extension from the URL path
		path := r.URL.Path
		ext := ""
		if idx := strings.LastIndex(path, "."); idx != -1 {
			ext = path[idx:] // Include the dot
		}

		// Get bucket name from environment
		bucket := os.Getenv("R2_BUCKET")
		if bucket == "" {
			bucket = "shiba-arcade" // fallback
		}

		// Construct the key with the file extension
		key := "misc-files/" + fileId + ext
		log.Printf("Looking for file with key: %s", key)

		// Get the object from R2
		log.Printf("Attempting to get file from R2: bucket=%s, key=%s", bucket, key)
		resp, err := srv.S3Client.GetObject(context.Background(), &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			log.Printf("Failed to get file %s from R2: %v", fileId, err)
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
		defer resp.Body.Close()

		// Set appropriate headers
		if resp.ContentType != nil {
			w.Header().Set("Content-Type", *resp.ContentType)
		}
		if resp.ContentLength != nil {
			w.Header().Set("Content-Length", fmt.Sprintf("%d", *resp.ContentLength))
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000") // Cache for 1 year

		// Stream the file content
		_, err = io.Copy(w, resp.Body)
		if err != nil {
			log.Printf("Failed to stream file %s: %v", fileId, err)
			http.Error(w, "Failed to serve file", http.StatusInternalServerError)
			return
		}
	}
}
