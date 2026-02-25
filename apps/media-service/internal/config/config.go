package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	GRPCHost string
	GRPCPort string

	S3Endpoint        string
	S3Region          string
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3Bucket          string
	S3UsePathStyle    bool
	PresignTTLSeconds int64
}

func Load() (*Config, error) {
	if err := loadEnvFile(".env"); err != nil {
		return nil, err
	}

	s3Region, err := requiredEnv("S3_REGION")
	if err != nil {
		return nil, err
	}
	s3AccessKeyID, err := requiredEnv("S3_ACCESS_KEY_ID")
	if err != nil {
		return nil, err
	}
	s3SecretAccessKey, err := requiredEnv("S3_SECRET_ACCESS_KEY")
	if err != nil {
		return nil, err
	}
	s3Bucket, err := requiredEnv("S3_BUCKET")
	if err != nil {
		return nil, err
	}

	ttlSeconds, err := strconv.ParseInt(getEnv("S3_PRESIGN_TTL_SECONDS", "900"), 10, 64)
	if err != nil || ttlSeconds <= 0 {
		return nil, fmt.Errorf("invalid S3_PRESIGN_TTL_SECONDS: %v", err)
	}

	usePathStyle, err := strconv.ParseBool(getEnv("S3_USE_PATH_STYLE", "true"))
	if err != nil {
		return nil, fmt.Errorf("invalid S3_USE_PATH_STYLE: %v", err)
	}

	cfg := &Config{
		GRPCHost: getEnv("GRPC_HOST", "0.0.0.0"),
		GRPCPort: getEnv("GRPC_PORT", "50055"),

		S3Endpoint:        getEnv("S3_ENDPOINT", ""),
		S3Region:          s3Region,
		S3AccessKeyID:     s3AccessKeyID,
		S3SecretAccessKey: s3SecretAccessKey,
		S3Bucket:          s3Bucket,
		S3UsePathStyle:    usePathStyle,
		PresignTTLSeconds: ttlSeconds,
	}

	return cfg, nil
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("missing required env: %s", key)
	}

	return value, nil
}

func loadEnvFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}

		return fmt.Errorf("open %s: %w", path, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)

		if key == "" {
			continue
		}

		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		if err := os.Setenv(key, value); err != nil {
			return fmt.Errorf("set env %s: %w", key, err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}

	return nil
}
