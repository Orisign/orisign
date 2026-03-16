package server

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	mediav1 "media-service/internal/pb"
	"media-service/internal/storage"
)

type MediaService struct {
	mediav1.UnimplementedMediaServiceServer
	storage *storage.S3Storage
	logger  *slog.Logger
}

const chatMediaFileNamePrefix = "chat-media::"

func NewMediaService(storageClient *storage.S3Storage, logger *slog.Logger) *MediaService {
	if logger == nil {
		logger = slog.Default()
	}

	return &MediaService{
		storage: storageClient,
		logger:  logger,
	}
}

func (s *MediaService) UploadAvatar(
	ctx context.Context,
	req *mediav1.UploadAvatarRequest,
) (*mediav1.UploadAvatarResponse, error) {
	if req.GetAccountId() == "" {
		s.logger.WarnContext(ctx, "upload rejected", "reason", "account_id is required")
		return nil, status.Error(codes.InvalidArgument, "account_id is required")
	}
	if len(req.GetData()) == 0 {
		s.logger.WarnContext(ctx, "upload rejected", "reason", "data is required", "account_id", req.GetAccountId())
		return nil, status.Error(codes.InvalidArgument, "data is required")
	}
	if req.GetContentType() == "" {
		s.logger.WarnContext(ctx, "upload rejected", "reason", "content_type is required", "account_id", req.GetAccountId())
		return nil, status.Error(codes.InvalidArgument, "content_type is required")
	}

	fileName := req.GetFileName()
	key := buildAvatarKey(req.GetAccountId(), fileName)
	assetType := "avatar"
	if strings.HasPrefix(fileName, chatMediaFileNamePrefix) {
		originalFileName := strings.TrimPrefix(fileName, chatMediaFileNamePrefix)
		key = buildMessageMediaKey(req.GetAccountId(), originalFileName)
		assetType = "message-media"
	}

	if err := s.storage.PutObject(ctx, key, req.GetContentType(), req.GetData()); err != nil {
		s.logger.ErrorContext(
			ctx,
			"upload failed",
			"asset_type", assetType,
			"account_id", req.GetAccountId(),
			"file_name", fileName,
			"content_type", req.GetContentType(),
			"bytes", len(req.GetData()),
			"key", key,
			"error", err,
		)
		return nil, status.Errorf(codes.Internal, "upload avatar: %v", err)
	}

	url, expiresAt, err := s.storage.SignedGetURL(ctx, key)
	if err != nil {
		s.logger.ErrorContext(
			ctx,
			"upload succeeded but url signing failed",
			"asset_type", assetType,
			"account_id", req.GetAccountId(),
			"key", key,
			"error", err,
		)
		return nil, status.Errorf(codes.Internal, "sign avatar url: %v", err)
	}

	s.logger.InfoContext(
		ctx,
		"upload succeeded",
		"asset_type", assetType,
		"account_id", req.GetAccountId(),
		"file_name", fileName,
		"content_type", req.GetContentType(),
		"bytes", len(req.GetData()),
		"key", key,
		"expires_at", expiresAt,
		"url_length", len(url),
	)

	return &mediav1.UploadAvatarResponse{
		Ok: true,
		Avatar: &mediav1.AvatarObject{
			Key:       key,
			Url:       url,
			ExpiresAt: expiresAt,
		},
	}, nil
}

func (s *MediaService) DeleteAvatar(
	ctx context.Context,
	req *mediav1.DeleteAvatarRequest,
) (*mediav1.DeleteAvatarResponse, error) {
	if req.GetKey() == "" {
		s.logger.WarnContext(ctx, "delete rejected", "reason", "key is required")
		return nil, status.Error(codes.InvalidArgument, "key is required")
	}

	if err := s.storage.DeleteObject(ctx, req.GetKey()); err != nil {
		s.logger.ErrorContext(ctx, "delete failed", "key", req.GetKey(), "error", err)
		return nil, status.Errorf(codes.Internal, "delete avatar: %v", err)
	}

	s.logger.InfoContext(ctx, "delete succeeded", "key", req.GetKey())

	return &mediav1.DeleteAvatarResponse{Ok: true}, nil
}

func (s *MediaService) GetAvatarUrl(
	ctx context.Context,
	req *mediav1.GetAvatarUrlRequest,
) (*mediav1.GetAvatarUrlResponse, error) {
	if req.GetKey() == "" {
		s.logger.WarnContext(ctx, "get url rejected", "reason", "key is required")
		return nil, status.Error(codes.InvalidArgument, "key is required")
	}

	url, expiresAt, err := s.storage.SignedGetURL(ctx, req.GetKey())
	if err != nil {
		s.logger.ErrorContext(ctx, "get url failed", "key", req.GetKey(), "error", err)
		return nil, status.Errorf(codes.Internal, "sign avatar url: %v", err)
	}

	s.logger.InfoContext(
		ctx,
		"get url succeeded",
		"key", req.GetKey(),
		"expires_at", expiresAt,
		"url_length", len(url),
	)

	return &mediav1.GetAvatarUrlResponse{
		Avatar: &mediav1.AvatarObject{
			Key:       req.GetKey(),
			Url:       url,
			ExpiresAt: expiresAt,
		},
	}, nil
}

func buildAvatarKey(accountID string, fileName string) string {
	extension := strings.ToLower(filepath.Ext(fileName))
	if extension == "" || len(extension) > 8 {
		extension = ".bin"
	}

	return fmt.Sprintf("avatars/%s/%s%s", accountID, uuid.NewString(), extension)
}

func buildMessageMediaKey(accountID string, fileName string) string {
	extension := strings.ToLower(filepath.Ext(fileName))
	if extension == "" || len(extension) > 8 {
		extension = ".bin"
	}

	return fmt.Sprintf("media/messages/%s/%s%s", accountID, uuid.NewString(), extension)
}
