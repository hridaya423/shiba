package api

import (
	handlers "shiba-api/handlers"
	"shiba-api/structs"

	"github.com/go-chi/chi/v5"
)

func SetupRoutes(r *chi.Mux, srv *structs.Server) {
	r.Get("/health", handlers.HealthCheckHandler)
}
