@echo off
set GOCACHE=%TEMP%\go-cache
set GOPATH=%USERPROFILE%\go
go build -o dist/media-service main.go
