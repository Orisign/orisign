package storage

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Storage struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
	presignTTL    time.Duration
}

type Params struct {
	Region          string
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	UsePathStyle    bool
	PresignTTL      time.Duration
}

func NewS3Storage(ctx context.Context, params Params) (*S3Storage, error) {
	cfg, err := awsConfig.LoadDefaultConfig(
		ctx,
		awsConfig.WithRegion(params.Region),
		awsConfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				params.AccessKeyID,
				params.SecretAccessKey,
				"",
			),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(options *s3.Options) {
		options.UsePathStyle = params.UsePathStyle
		if params.Endpoint != "" {
			options.BaseEndpoint = aws.String(params.Endpoint)
		}
	})

	return &S3Storage{
		client:        client,
		presignClient: s3.NewPresignClient(client),
		bucket:        params.Bucket,
		presignTTL:    params.PresignTTL,
	}, nil
}

func (s *S3Storage) PutObject(
	ctx context.Context,
	key string,
	contentType string,
	data []byte,
) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
		Body:        bytes.NewReader(data),
	})
	if err != nil {
		return fmt.Errorf("put object: %w", err)
	}

	return nil
}

func (s *S3Storage) DeleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("delete object: %w", err)
	}

	return nil
}

func (s *S3Storage) SignedGetURL(
	ctx context.Context,
	key string,
) (string, int64, error) {
	result, err := s.presignClient.PresignGetObject(
		ctx,
		&s3.GetObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(key),
		},
		func(options *s3.PresignOptions) {
			options.Expires = s.presignTTL
		},
	)
	if err != nil {
		return "", 0, fmt.Errorf("presign get object: %w", err)
	}

	expiresAt := time.Now().Add(s.presignTTL).UnixMilli()

	return result.URL, expiresAt, nil
}
