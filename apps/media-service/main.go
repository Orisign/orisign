package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"media-service/internal/config"
	"media-service/internal/logger"
	mediav1 "media-service/internal/pb"
	"media-service/internal/server"
	"media-service/internal/storage"
)

const oneGBInBytes = 1024 * 1024 * 1024

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("load config: %v\n", err)
		os.Exit(1)
	}

	appLogger := logger.New("media-service", cfg.LogLevel)
	slog.SetDefault(appLogger)

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
		appLogger.Error("failed to initialize storage", "error", err)
		os.Exit(1)
	}

	address := fmt.Sprintf("%s:%s", cfg.GRPCHost, cfg.GRPCPort)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		appLogger.Error("failed to bind tcp listener", "address", address, "error", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer(
		grpc.MaxRecvMsgSize(oneGBInBytes),
		grpc.MaxSendMsgSize(oneGBInBytes),
		grpc.UnaryInterceptor(unaryLoggingInterceptor(appLogger)),
	)
	mediav1.RegisterMediaServiceServer(
		grpcServer,
		server.NewMediaService(storageClient, appLogger),
	)

	appLogger.Info(
		"starting gRPC server",
		"address", address,
		"s3_bucket", cfg.S3Bucket,
		"s3_region", cfg.S3Region,
		"s3_endpoint", cfg.S3Endpoint,
		"presign_ttl_sec", cfg.PresignTTLSeconds,
		"log_level", cfg.LogLevel,
	)

	go func() {
		if serveErr := grpcServer.Serve(listener); serveErr != nil {
			appLogger.Error("gRPC server stopped with error", "error", serveErr)
			os.Exit(1)
		}
	}()

	stopSignal := make(chan os.Signal, 1)
	signal.Notify(stopSignal, syscall.SIGTERM, syscall.SIGINT)
	<-stopSignal

	appLogger.Info("shutdown signal received")
	grpcServer.GracefulStop()
	appLogger.Info("media-service stopped")
}

func unaryLoggingInterceptor(log *slog.Logger) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		startedAt := time.Now()
		response, err := handler(ctx, req)
		elapsed := time.Since(startedAt)
		code := status.Code(err)

		logArgs := []any{
			"method", info.FullMethod,
			"code", code.String(),
			"duration_ms", elapsed.Milliseconds(),
			"request_bytes", protoMessageSize(req),
			"response_bytes", protoMessageSize(response),
		}

		requestID := requestIDFromContext(ctx)
		if requestID != "" {
			logArgs = append(logArgs, "request_id", requestID)
		}

		if err != nil {
			logArgs = append(logArgs, "error", err.Error())

			switch code {
			case codes.InvalidArgument, codes.NotFound, codes.PermissionDenied, codes.Unauthenticated:
				log.Warn("gRPC request failed", logArgs...)
			default:
				log.Error("gRPC request failed", logArgs...)
			}

			return response, err
		}

		log.Info("gRPC request completed", logArgs...)
		return response, nil
	}
}

func protoMessageSize(value interface{}) int {
	message, ok := value.(proto.Message)
	if !ok || message == nil {
		return 0
	}

	return proto.Size(message)
}

func requestIDFromContext(ctx context.Context) string {
	meta, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}

	candidates := []string{
		"x-request-id",
		"x-correlation-id",
		"request-id",
	}

	for _, key := range candidates {
		values := meta.Get(key)
		if len(values) > 0 && values[0] != "" {
			return values[0]
		}
	}

	return ""
}
