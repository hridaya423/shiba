package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"shiba-api/api"
	"shiba-api/structs"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
)

func NewServer(s3c *s3.Client, localStorageDir, gamesPrefix string) *structs.Server {
	return &structs.Server{
		S3Client:        s3c,
		LocalStorageDir: localStorageDir,
		GamesPrefix:     gamesPrefix,
	}
}

func main() {
	r2AccessKey := os.Getenv("R2_ACCESS_KEY_ID")
	r2SecretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	r2Region := os.Getenv("R2_REGION")
	r2Endpoint := os.Getenv("R2_ENDPOINT")

	cfg, err := config.LoadDefaultConfig(
		context.TODO(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			r2AccessKey, r2SecretKey, "",
		)),
		config.WithRegion(r2Region),
		config.WithEndpointResolverWithOptions(
			aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:           r2Endpoint,
					SigningRegion: r2Region,
				}, nil
			}),
		),
	)

	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	s3Client := s3.NewFromConfig(cfg)
	srv := NewServer(s3Client, "./local_storage", "games")

	_ = srv

	r := chi.NewRouter()
	api.SetupRoutes(r, srv) // attach all routes

	log.Println("Listening on :3001")
	if err := http.ListenAndServe(":3001", r); err != nil {
		log.Fatal(err)
	}
}
