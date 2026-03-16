package logger

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
)

const (
	colorReset  = "\x1b[0m"
	colorGray   = "\x1b[90m"
	colorBlue   = "\x1b[34m"
	colorGreen  = "\x1b[32m"
	colorYellow = "\x1b[33m"
	colorRed    = "\x1b[31m"
)

func New(serviceName string, levelValue string) *slog.Logger {
	level := parseLevel(levelValue)
	useColor := shouldUseColor()

	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(_ []string, attr slog.Attr) slog.Attr {
			switch attr.Key {
			case slog.TimeKey:
				if timestamp, ok := attr.Value.Any().(time.Time); ok {
					formatted := timestamp.Format("15:04:05.000")
					if useColor {
						formatted = colorGray + formatted + colorReset
					}
					return slog.String(slog.TimeKey, formatted)
				}
			case slog.LevelKey:
				levelLabel := attr.Value.String()
				if useColor {
					levelLabel = colorizeLevel(levelLabel)
				}
				return slog.String(slog.LevelKey, levelLabel)
			}

			return attr
		},
	})

	return slog.New(handler).With("service", serviceName)
}

func parseLevel(value string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func shouldUseColor() bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}

	term := strings.TrimSpace(strings.ToLower(os.Getenv("TERM")))
	return term != "" && term != "dumb"
}

func colorizeLevel(levelLabel string) string {
	switch levelLabel {
	case "DEBUG":
		return colorBlue + levelLabel + colorReset
	case "INFO":
		return colorGreen + levelLabel + colorReset
	case "WARN":
		return colorYellow + levelLabel + colorReset
	case "ERROR":
		return colorRed + levelLabel + colorReset
	default:
		return fmt.Sprintf("%s%s%s", colorGray, levelLabel, colorReset)
	}
}
