package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"

	mediav1 "media-service/internal/pb"
	"media-service/internal/config"
	"media-service/internal/server"
	"media-service/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	ctx := context.Background()

	storageClient, err := storage.NewS3Storage(ctx, storage.Params{
		Region:          cfg.S3Region,
		Endpoint:        cfg.S3Endpoint,
		AccessKeyID:     cfg.S3AccessKeyID,
		SecretAccessKey: cfg.S3SecretAccessKey,
		Bucket:          cfg.S3Bucket,
		UsePathStyle:    cfg.S3UsePathStyle,
		PresignTTL:      time.Duration(cfg.PresignTTLSeconds) * time.Second,
	})
	if err != nil {
		log.Fatalf("create s3 storage: %v", err)
	}

	address := fmt.Sprintf("%s:%s", cfg.GRPCHost, cfg.GRPCPort)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("listen %s: %v", address, err)
	}

	grpcServer := grpc.NewServer()
	mediav1.RegisterMediaServiceServer(
		grpcServer,
		server.NewMediaService(storageClient),
	)

	go func() {
		log.Printf("media-service gRPC listening on %s", address)
		if serveErr := grpcServer.Serve(listener); serveErr != nil {
			log.Fatalf("grpc serve: %v", serveErr)
		}
	}()

	stopSignal := make(chan os.Signal, 1)
	signal.Notify(stopSignal, syscall.SIGTERM, syscall.SIGINT)
	<-stopSignal

	grpcServer.GracefulStop()
	log.Print("media-service stopped")
}
