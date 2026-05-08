"use client";

import {
  getUsersControllerMeQueryKey,
  useUsersControllerAddAvatar,
} from "@/api/generated";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Slider,
  cn,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CROP_PREVIEW_SIZE = 280;
const AVATAR_OUTPUT_SIZE = 512;

type AvatarCropUploaderProps = {
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onUpload: (file: File) => Promise<void>;
};

type CropOffset = {
  x: number;
  y: number;
};

type NaturalSize = {
  width: number;
  height: number;
};

function createCroppedAvatarFile(
  image: HTMLImageElement,
  fileName: string,
  offset: CropOffset,
  zoom: number,
) {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const baseScale = Math.max(
    CROP_PREVIEW_SIZE / naturalWidth,
    CROP_PREVIEW_SIZE / naturalHeight,
  );
  const scale = baseScale * zoom;
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  const imageLeft = CROP_PREVIEW_SIZE / 2 + offset.x - displayWidth / 2;
  const imageTop = CROP_PREVIEW_SIZE / 2 + offset.y - displayHeight / 2;
  const sourceX = Math.max(0, -imageLeft / scale);
  const sourceY = Math.max(0, -imageTop / scale);
  const sourceSize = Math.min(
    CROP_PREVIEW_SIZE / scale,
    naturalWidth - sourceX,
    naturalHeight - sourceY,
  );
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available");
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to crop avatar"));
        return;
      }

      const normalizedName = fileName.replace(/\.[a-z0-9]{2,8}$/i, "") || "avatar";
      resolve(new File([blob], `${normalizedName}.png`, { type: "image/png" }));
    }, "image/png");
  });
}

export function AvatarCropUploader({
  className,
  buttonClassName,
  disabled = false,
  ariaLabel,
  onUpload,
}: AvatarCropUploaderProps) {
  const t = useTranslations("shared.avatarUploadButton");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: CropOffset;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("avatar.png");
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOpen = Boolean(imageUrl);
  const isDisabled = disabled || isSubmitting;

  const metrics = useMemo(() => {
    if (!naturalSize) {
      return {
        width: CROP_PREVIEW_SIZE,
        height: CROP_PREVIEW_SIZE,
      };
    }

    const baseScale = Math.max(
      CROP_PREVIEW_SIZE / naturalSize.width,
      CROP_PREVIEW_SIZE / naturalSize.height,
    );

    return {
      width: naturalSize.width * baseScale * zoom,
      height: naturalSize.height * baseScale * zoom,
    };
  }, [naturalSize, zoom]);

  const clampOffset = useCallback(
    (nextOffset: CropOffset, nextZoom = zoom) => {
      if (!naturalSize) return { x: 0, y: 0 };

      const baseScale = Math.max(
        CROP_PREVIEW_SIZE / naturalSize.width,
        CROP_PREVIEW_SIZE / naturalSize.height,
      );
      const displayWidth = naturalSize.width * baseScale * nextZoom;
      const displayHeight = naturalSize.height * baseScale * nextZoom;
      const maxX = Math.max(0, (displayWidth - CROP_PREVIEW_SIZE) / 2);
      const maxY = Math.max(0, (displayHeight - CROP_PREVIEW_SIZE) / 2);

      return {
        x: Math.min(maxX, Math.max(-maxX, nextOffset.x)),
        y: Math.min(maxY, Math.max(-maxY, nextOffset.y)),
      };
    },
    [naturalSize, zoom],
  );

  useEffect(() => {
    setOffset((current) => clampOffset(current, zoom));
  }, [clampOffset, zoom]);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  function resetDraft() {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl("");
    setNaturalSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setFileName(file.name || "avatar.png");
    setImageUrl(URL.createObjectURL(file));
    setNaturalSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!naturalSize || isSubmitting) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: offset,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setOffset(
      clampOffset({
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      }),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function handleApplyCrop() {
    const image = imageRef.current;
    if (!image || !naturalSize) return;

    try {
      setIsSubmitting(true);
      const croppedFile = await createCroppedAvatarFile(image, fileName, offset, zoom);
      await onUpload(croppedFile);
      resetDraft();
    } catch {
      toast({
        title: t("uploadError"),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className={className}
      aria-label={ariaLabel ?? t("ariaLabel")}
    >
      <input
        ref={inputRef}
        name="avatar"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        disabled={isDisabled}
      />
      <Button
        type="button"
        variant="default"
        className={cn("h-13 w-13 rounded-full p-1", buttonClassName)}
        disabled={isDisabled}
        onClick={() => inputRef.current?.click()}
        aria-label={ariaLabel ?? t("ariaLabel")}
      >
        <ImagePlus className="size-7" strokeWidth={2.5} />
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            resetDraft();
          }
        }}
      >
        <DialogContent className="w-[min(29rem,calc(100vw-1rem))] max-w-none gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 shadow-none">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>{t("cropTitle")}</DialogTitle>
            <DialogDescription>{t("cropDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-5 px-5 py-5">
            <div
              className="relative cursor-grab touch-none overflow-hidden rounded-full border border-border bg-muted active:cursor-grabbing"
              style={{ width: CROP_PREVIEW_SIZE, height: CROP_PREVIEW_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {imageUrl ? (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt=""
                  draggable={false}
                  className="absolute select-none object-cover"
                  style={{
                    width: metrics.width,
                    height: metrics.height,
                    left: `calc(50% + ${offset.x}px)`,
                    top: `calc(50% + ${offset.y}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onLoad={(event) => {
                    setNaturalSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                    setOffset({ x: 0, y: 0 });
                  }}
                />
              ) : null}
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t("zoom")}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <Slider
                min={1}
                max={3}
                step={0.05}
                value={[zoom]}
                onValueChange={(value) => {
                  const nextZoom = value[0] ?? 1;
                  setZoom(nextZoom);
                  setOffset((current) => clampOffset(current, nextZoom));
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border px-5 py-4 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={resetDraft}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void handleApplyCrop()}
              disabled={!naturalSize || isSubmitting}
            >
              {t("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

type AvatarUploadButtonProps = {
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onUpload?: (file: File) => Promise<void>;
};

export function AvatarUploadButton({
  className,
  buttonClassName,
  disabled = false,
  ariaLabel,
  onUpload,
}: AvatarUploadButtonProps) {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useUsersControllerAddAvatar();

  async function uploadProfileAvatar(file: File) {
    if (onUpload) {
      await onUpload(file);
      return;
    }

    await mutateAsync({ data: { file } });
    await queryClient.invalidateQueries({
      queryKey: getUsersControllerMeQueryKey(),
    });
  }

  return (
    <AvatarCropUploader
      className={className}
      buttonClassName={buttonClassName}
      disabled={disabled || isPending}
      ariaLabel={ariaLabel}
      onUpload={uploadProfileAvatar}
    />
  );
}
