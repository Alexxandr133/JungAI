import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlatformIcon } from '../../components/icons';
import { resolvePublicFileUrl } from '../../lib/api';
import { authorLabel, excerptFromHtml, formatForumTime, resolvePostType, type ForumPost } from './forumUtils';

type KebabProps = {
  canPin?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
};

export function PostKebab({ canPin, isPinned, onPin, canDelete, onDelete }: KebabProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const show = Boolean((canPin && onPin) || (canDelete && onDelete));

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!show) return null;

  return (
    <div className="forum__card-head" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="forum__kebab"
        aria-label="Действия с постом"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="forum__menu">
          {canPin && onPin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPin();
              }}
            >
              {isPinned ? 'Открепить' : 'Закрепить сверху'}
            </button>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              className="forum__menu-danger"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Удалить пост
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  post: ForumPost;
  showCommunity?: boolean;
  onLike?: (post: ForumPost) => void;
  onPin?: (post: ForumPost) => void;
  onDelete?: (post: ForumPost) => void;
};

export function ThreadCard({ post, showCommunity = true, onLike, onPin, onDelete }: Props) {
  const navigate = useNavigate();
  const excerpt = excerptFromHtml(post.content);
  const avatar = resolvePublicFileUrl(post.author?.avatarUrl);
  const href = `/publications/post/${post.id}`;
  const preview = post.id === 'preview';

  return (
    <article className="forum__row">
      <div
        className="forum__row-main"
        role={preview ? undefined : 'link'}
        tabIndex={preview ? undefined : 0}
        onClick={preview ? undefined : () => navigate(href)}
        onKeyDown={
          preview
            ? undefined
            : (e) => {
                if (e.key === 'Enter') navigate(href);
              }
        }
      >
        <div className="forum__row-topline">
          {showCommunity && post.community?.slug ? (
            <Link
              to={`/publications/community/${post.community.slug}`}
              className="forum__row-community"
              onClick={(e) => e.stopPropagation()}
            >
              {post.community.name}
            </Link>
          ) : (
            <span className="forum__row-community is-muted">Без сообщества</span>
          )}
          {resolvePostType(post.flair) ? <span className="forum__row-type">{resolvePostType(post.flair)}</span> : null}
          {post.isPinned && <span className="forum__row-pin">Закреплено</span>}
          <PostKebab
            canPin={Boolean(post.canPin)}
            isPinned={post.isPinned}
            onPin={post.canPin && onPin ? () => onPin(post) : undefined}
            canDelete={Boolean(post.canDelete)}
            onDelete={post.canDelete && onDelete ? () => onDelete(post) : undefined}
          />
        </div>
        <h2 className="forum__row-title">{post.title}</h2>
        {excerpt && <p className="forum__row-excerpt">{excerpt}</p>}
      </div>
      <div className="forum__row-meta">
        <div className="forum__meta-left">
          <span className="forum__avatar">
            {avatar ? <img src={avatar} alt="" /> : authorLabel(post).slice(0, 1).toUpperCase()}
          </span>
          <span className="forum__row-author">{authorLabel(post)}</span>
          <span className="forum__row-time">{formatForumTime(post.createdAt)}</span>
        </div>
        <div className="forum__stats">
          <span className="forum__stat" style={{ cursor: 'default' }} title="Ответы">
            <PlatformIcon name="message" size={14} strokeWidth={2} />
            {post.commentsCount || 0}
          </span>
          <button
            type="button"
            className="forum__stat"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLike?.(post);
            }}
          >
            <PlatformIcon name="thumbsUp" size={14} strokeWidth={2} />
            {post.reactionsCount || 0}
          </button>
        </div>
      </div>
    </article>
  );
}
