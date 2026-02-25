package server

import (
	"context"
	"fmt"
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
}

func NewMediaService(storageClient *storage.S3Storage) *MediaService {
	return &MediaService{
		storage: storageClient,
	}
}

func (s *MediaService) UploadAvatar(
	ctx context.Context,
	req *mediav1.UploadAvatarRequest,
) (*mediav1.UploadAvatarResponse, error) {
	if req.GetAccountId() == "" {
		return nil, status.Error(codes.InvalidArgument, "account_id is required")
	}
	if len(req.GetData()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "data is required")
	}
	if req.GetContentType() == "" {
		return nil, status.Error(codes.InvalidArgument, "content_type is required")
	}

	key := buildAvatarKey(req.GetAccountId(), req.GetFileName())
	if err := s.storage.PutObject(ctx, key, req.GetContentType(), req.GetData()); err != nil {
		return nil, status.Errorf(codes.Internal, "upload avatar: %v", err)
	}

	url, expiresAt, err := s.storage.SignedGetURL(ctx, key)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "sign avatar url: %v", err)
	}

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
		return nil, status.Error(codes.InvalidArgument, "key is required")
	}

	if err := s.storage.DeleteObject(ctx, req.GetKey()); err != nil {
		return nil, status.Errorf(codes.Internal, "delete avatar: %v", err)
	}

	return &mediav1.DeleteAvatarResponse{Ok: true}, nil
}

func (s *MediaService) GetAvatarUrl(
	ctx context.Context,
	req *mediav1.GetAvatarUrlRequest,
) (*mediav1.GetAvatarUrlResponse, error) {
	if req.GetKey() == "" {
		return nil, status.Error(codes.InvalidArgument, "key is required")
	}

	url, expiresAt, err := s.storage.SignedGetURL(ctx, req.GetKey())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "sign avatar url: %v", err)
	}

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
