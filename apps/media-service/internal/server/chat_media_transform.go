package server

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	chatMediaCircleOutputExtension = ".mp4"
	chatMediaVoiceOutputExtension  = ".ogg"
)

func transformChatMedia(
	ctx context.Context,
	kind string,
	fileName string,
	contentType string,
	payload []byte,
	logger *slog.Logger,
) ([]byte, string, string) {
	if len(payload) == 0 {
		return payload, contentType, fileName
	}

	switch kind {
	case chatMediaKindRing:
		return transformRingCircleVideo(ctx, fileName, contentType, payload, logger)
	case chatMediaKindVoice:
		return transformVoiceAudio(ctx, fileName, payload, logger)
	default:
		return payload, contentType, fileName
	}
}

func transformRingCircleVideo(
	ctx context.Context,
	fileName string,
	contentType string,
	payload []byte,
	logger *slog.Logger,
) ([]byte, string, string) {
	startedAt := time.Now()
	inputExtension := normalizeFileExtension(fileName, ".mp4")
	outFileName := replaceFileExtension(fileName, chatMediaCircleOutputExtension)

	withWatermarkFilter := "crop='min(iw,ih)':'min(iw,ih)',scale=640:640:force_original_aspect_ratio=increase,crop=640:640,drawtext=text='Orisign':fontcolor=white@0.82:fontsize=22:x=w-tw-20:y=h-th-20:shadowcolor=black@0.55:shadowx=1:shadowy=1"
	baseFilter := "crop='min(iw,ih)':'min(iw,ih)',scale=640:640:force_original_aspect_ratio=increase,crop=640:640"

	commonArgs := []string{
		"-analyzeduration", "24M",
		"-probesize", "24M",
		"-movflags", "+faststart",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "24",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac",
		"-b:a", "96k",
		"-ac", "1",
	}

	output, err := transcodeWithFFmpeg(
		ctx,
		inputExtension,
		chatMediaCircleOutputExtension,
		payload,
		append([]string{"-vf", withWatermarkFilter}, commonArgs...),
	)
	if err != nil {
		// drawtext can fail in slim ffmpeg builds without font support.
		output, err = transcodeWithFFmpeg(
			ctx,
			inputExtension,
			chatMediaCircleOutputExtension,
			payload,
			append([]string{"-vf", baseFilter}, commonArgs...),
		)
		if err != nil {
			logger.WarnContext(
				ctx,
				"ring transform fallback to original",
				"file_name", fileName,
				"input_bytes", len(payload),
				"error", err,
				"elapsed_ms", time.Since(startedAt).Milliseconds(),
			)
			return payload, contentTypeFromVideoFileName(fileName, contentType), fileName
		}
	}

	logger.InfoContext(
		ctx,
		"ring transform completed",
		"file_name", fileName,
		"output_file_name", outFileName,
		"input_bytes", len(payload),
		"output_bytes", len(output),
		"elapsed_ms", time.Since(startedAt).Milliseconds(),
	)

	return output, "video/mp4", outFileName
}

func transformVoiceAudio(
	ctx context.Context,
	fileName string,
	payload []byte,
	logger *slog.Logger,
) ([]byte, string, string) {
	startedAt := time.Now()
	inputExtension := normalizeFileExtension(fileName, ".webm")
	outFileName := replaceFileExtension(fileName, chatMediaVoiceOutputExtension)

	output, err := transcodeWithFFmpeg(
		ctx,
		inputExtension,
		chatMediaVoiceOutputExtension,
		payload,
		[]string{
			"-vn",
			"-ac", "1",
			"-ar", "48000",
			"-c:a", "libopus",
			"-b:a", "48k",
			"-application", "voip",
		},
	)
	if err != nil {
		logger.WarnContext(
			ctx,
			"voice transform fallback to original",
			"file_name", fileName,
			"input_bytes", len(payload),
			"error", err,
			"elapsed_ms", time.Since(startedAt).Milliseconds(),
		)
		return payload, contentTypeFromFileName(fileName, "audio/webm"), fileName
	}

	logger.InfoContext(
		ctx,
		"voice transform completed",
		"file_name", fileName,
		"output_file_name", outFileName,
		"input_bytes", len(payload),
		"output_bytes", len(output),
		"elapsed_ms", time.Since(startedAt).Milliseconds(),
	)

	return output, "audio/ogg", outFileName
}

func transcodeWithFFmpeg(
	ctx context.Context,
	inputExtension string,
	outputExtension string,
	payload []byte,
	ffmpegArgs []string,
) ([]byte, error) {
	inputFile, err := os.CreateTemp("", "orisign-media-input-*"+inputExtension)
	if err != nil {
		return nil, err
	}
	defer os.Remove(inputFile.Name())

	if _, err := inputFile.Write(payload); err != nil {
		inputFile.Close()
		return nil, err
	}
	if err := inputFile.Close(); err != nil {
		return nil, err
	}

	outputFile, err := os.CreateTemp("", "orisign-media-output-*"+outputExtension)
	if err != nil {
		return nil, err
	}
	outputPath := outputFile.Name()
	if err := outputFile.Close(); err != nil {
		return nil, err
	}
	defer os.Remove(outputPath)

	args := []string{
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-i", inputFile.Name(),
	}
	args = append(args, ffmpegArgs...)
	args = append(args, outputPath)

	command := exec.CommandContext(ctx, "ffmpeg", args...)
	var stderr bytes.Buffer
	command.Stderr = &stderr

	if err := command.Run(); err != nil {
		if strings.TrimSpace(stderr.String()) != "" {
			return nil, execErrorWithOutput(err, stderr.String())
		}
		return nil, err
	}

	output, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, err
	}

	return output, nil
}

func normalizeFileExtension(fileName string, fallback string) string {
	extension := strings.ToLower(filepath.Ext(fileName))
	if extension == "" || len(extension) > 8 {
		return fallback
	}
	return extension
}

func replaceFileExtension(fileName string, extension string) string {
	if extension == "" {
		return fileName
	}

	base := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	if base == "" {
		base = "media"
	}

	return base + extension
}

func contentTypeFromFileName(fileName string, fallback string) string {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".mp3":
		return "audio/mpeg"
	case ".ogg", ".oga":
		return "audio/ogg"
	case ".wav":
		return "audio/wav"
	case ".aac":
		return "audio/aac"
	case ".m4a", ".mp4":
		return "audio/mp4"
	case ".webm":
		return "audio/webm"
	default:
		return fallback
	}
}

func contentTypeFromVideoFileName(fileName string, fallback string) string {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".mp4", ".m4v":
		return "video/mp4"
	case ".mov":
		return "video/quicktime"
	case ".webm":
		return "video/webm"
	case ".mkv":
		return "video/x-matroska"
	default:
		return fallback
	}
}

type ffmpegExecError struct {
	baseError error
	output    string
}

func (e *ffmpegExecError) Error() string {
	return e.baseError.Error() + ": " + strings.TrimSpace(e.output)
}

func execErrorWithOutput(baseErr error, output string) error {
	return &ffmpegExecError{
		baseError: baseErr,
		output:    output,
	}
}
