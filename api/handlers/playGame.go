package handlers

import (
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"shiba-api/structs"

	"github.com/go-chi/chi/v5"
)

// UUID regex pattern for validation
var uuidRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// validateGameId ensures the gameId is a valid UUID and doesn't contain path traversal
func validateGameId(gameId string) bool {
	if gameId == "" {
		return false
	}
	// Check if it's a valid UUID
	if !uuidRegex.MatchString(gameId) {
		return false
	}
	// Check for path traversal attempts
	if filepath.Clean(gameId) != gameId {
		return false
	}
	return true
}

// validateAssetPath ensures the asset path is safe and doesn't contain path traversal
func validateAssetPath(assetPath string) bool {
	if assetPath == "" {
		return true
	}
	// Check for path traversal attempts
	cleanPath := filepath.Clean(assetPath)
	if cleanPath != assetPath {
		return false
	}
	// Prevent access to hidden files or directories
	if filepath.Base(assetPath)[0] == '.' {
		return false
	}
	return true
}

func MainGamePlayHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		if !validateGameId(gameId) {
			http.Error(w, "Invalid game ID", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")

		var filepath = "./games/" + gameId + "/index.html"

		log.Printf("Serving game %s from %s", gameId, filepath)

		http.ServeFile(w, r, filepath)
	}
}

func AssetsPlayHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		if !validateGameId(gameId) {
			http.Error(w, "Invalid game ID", http.StatusBadRequest)
			return
		}

		assetPath := chi.URLParam(r, "*")
		if assetPath == "" {
			var filepath = "./games/" + gameId + "/index.html"
			http.ServeFile(w, r, filepath)
		} else {
			if !validateAssetPath(assetPath) {
				http.Error(w, "Invalid asset path", http.StatusBadRequest)
				return
			}
			var filepath = "./games/" + gameId + "/" + assetPath
			http.ServeFile(w, r, filepath)
		}
	}
}
