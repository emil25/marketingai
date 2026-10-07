import { useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Play,
  Share2,
} from "lucide-react";
import type { PostPlatform } from "@/lib/data-model";
import { postCopyText } from "@/lib/post-editor";

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  "google-business": "Google Business",
  pinterest: "Pinterest",
};

export function PlatformMark({ platform }: { platform: string }) {
  const glyphs: Record<string, string> = {
    facebook: "f",
    instagram: "◎",
    tiktok: "♪",
    linkedin: "in",
    youtube: "▶",
    "google-business": "G",
    pinterest: "p",
  };
  return (
    <span
      aria-label={SOCIAL_LABELS[platform] ?? platform}
      className={`platform-mark platform-${platform}`}
    >
      {glyphs[platform] ?? "•"}
    </span>
  );
}

type PreviewVariant = { platform: PostPlatform; content: string; cta: string; hashtags: string[] };
type PreviewMedia = { id: string; mimeType: string; altText?: string | null; filename?: string };

export function SocialPreview({
  brandName,
  variants,
  media = [],
  compact = false,
  selectedPlatform,
  onSelectPlatform,
}: {
  brandName: string;
  variants: PreviewVariant[];
  media?: PreviewMedia[];
  compact?: boolean;
  selectedPlatform?: PostPlatform;
  onSelectPlatform?: (platform: PostPlatform) => void;
}) {
  const [selected, setSelected] = useState<string>(variants[0]?.platform ?? "facebook");
  const [expanded, setExpanded] = useState(false);
  const [imagePage, setImagePage] = useState(0);
  const active =
    variants.find((variant) => variant.platform === (selectedPlatform ?? selected)) ?? variants[0];
  const images = media.filter((item) => item.mimeType.startsWith("image/"));
  const firstAsset = media.find(
    (item) => item.mimeType.startsWith("image/") || item.mimeType.startsWith("video/"),
  );
  const canPage = !compact && firstAsset?.mimeType.startsWith("image/") && images.length > 1;
  const page = Math.min(imagePage, Math.max(0, images.length - 1));
  const asset = canPage ? images[page] : firstAsset;
  if (!active) {
    const platform = selectedPlatform ?? "facebook";
    return (
      <div className="social-preview">
        <div className="social-preview-post" data-platform={platform}>
          <div className="social-preview-account">
            <span className="social-preview-avatar">{brandName.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{brandName}</strong>
              <small>{SOCIAL_LABELS[platform]} · Előnézet</small>
            </span>
          </div>
          <div className="social-preview-skeleton" aria-hidden="true">
            <ImageIcon className="h-8 w-8" />
            <span />
            <span />
            <span />
          </div>
          <div className="social-preview-caption">
            <strong>A kész posztod előnézete</strong>
            <p>Írd le az ötletedet, és készíts szöveget a kijelölt csatornákra.</p>
          </div>
        </div>
      </div>
    );
  }
  const text = postCopyText(active);
  const shortVideo = active.platform === "tiktok" || active.platform === "youtube";
  const imageFirst = active.platform === "instagram" || shortVideo;
  const mediaBlock = asset ? (
    <div className={`social-preview-media ${shortVideo ? "social-preview-portrait" : ""}`}>
      {asset.mimeType.startsWith("video/") ? (
        <video
          key={asset.id}
          src={`/api/media/${asset.id}`}
          controls={!compact}
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          key={asset.id}
          src={`/api/media/${asset.id}`}
          alt={asset.altText || asset.filename || "A poszt képe"}
        />
      )}
      {canPage && (
        <div className="flex items-center justify-center gap-3 border-t bg-card p-2 text-sm">
          <button
            type="button"
            aria-label="Előző kép az előnézetben"
            disabled={page === 0}
            onClick={() => setImagePage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            {page + 1} / {images.length}
          </span>
          <button
            type="button"
            aria-label="Következő kép az előnézetben"
            disabled={page === images.length - 1}
            onClick={() => setImagePage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  ) : imageFirst ? (
    <div className={`social-preview-media-missing ${shortVideo ? "social-preview-portrait" : ""}`}>
      <span>{shortVideo ? <Play className="h-7 w-7" /> : <ImageIcon className="h-7 w-7" />}</span>
      <strong>{shortVideo ? "Videó helye" : "A képed helye"}</strong>
      <small>Adj saját médiát a posztodhoz.</small>
    </div>
  ) : null;
  const textBlock = (
    <div className="social-preview-caption">
      <p className={compact || (!expanded && text.length > 420) ? "line-clamp-6" : ""}>
        {text || "Még nincs posztszöveg."}
      </p>
      {!compact && text.length > 420 && (
        <button type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Kevesebb" : "Teljes szöveg"}
        </button>
      )}
    </div>
  );
  return (
    <div className={`social-preview ${compact ? "social-preview-compact" : ""}`}>
      {variants.length > 1 && !compact && (
        <div className="social-preview-tabs" aria-label="Előnézeti csatorna">
          {variants.map((variant) => (
            <button
              key={variant.platform}
              type="button"
              aria-label={`${SOCIAL_LABELS[variant.platform]} előnézet`}
              aria-pressed={active.platform === variant.platform}
              onClick={() => {
                setSelected(variant.platform);
                onSelectPlatform?.(variant.platform);
                setExpanded(false);
              }}
            >
              <PlatformMark platform={variant.platform} />
              {SOCIAL_LABELS[variant.platform]}
            </button>
          ))}
        </div>
      )}
      <div className="social-preview-post" data-platform={active.platform}>
        <div className="social-preview-account">
          <span className="social-preview-avatar">{brandName.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{brandName}</strong>
            <small>{SOCIAL_LABELS[active.platform]} · Posztelőnézet</small>
          </span>
          <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
        </div>
        {imageFirst ? (
          <>
            {mediaBlock}
            {textBlock}
          </>
        ) : (
          <>
            {textBlock}
            {mediaBlock}
          </>
        )}
        <div className="social-preview-reactions" aria-hidden="true">
          <Heart />
          <MessageCircle />
          <Share2 />
          <Bookmark className="ml-auto" />
        </div>
      </div>
      {!compact && (
        <p className="social-preview-note">Előnézet · A végleges megjelenés a csatornától függ.</p>
      )}
    </div>
  );
}
