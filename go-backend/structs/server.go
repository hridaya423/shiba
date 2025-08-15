package structs

import "github.com/aws/aws-sdk-go-v2/service/s3"

type Server struct {
	S3Client        *s3.Client
	LocalStorageDir string
	GamesPrefix     string
}
