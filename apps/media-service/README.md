# media-service

Go gRPC service for private avatar storage in S3-compatible object storage.

## Env

Use `.env.example` as reference:

- `GRPC_HOST`, `GRPC_PORT`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_USE_PATH_STYLE`
- `S3_PRESIGN_TTL_SECONDS`

## Run

```bash
go mod tidy
go run .
```
