import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

// In-memory storage for demo (можно заменить на БД)
let topics: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  postsCount: number;
  createdAt: string;
}> = [
  { id: 't1', name: 'Методики работы', description: 'Обмен опытом по техникам терапии', icon: '🧠', postsCount: 24, createdAt: new Date().toISOString() },
  { id: 't2', name: 'Кейсы и разборы', description: 'Обсуждение клинических случаев', icon: '📋', postsCount: 18, createdAt: new Date().toISOString() },
  { id: 't3', name: 'Супервизия', description: 'Вопросы и консультации коллег', icon: '👥', postsCount: 31, createdAt: new Date().toISOString() },
  { id: 't4', name: 'Исследования', description: 'Научные публикации и исследования', icon: '🔬', postsCount: 42, createdAt: new Date().toISOString() },
  { id: 't5', name: 'Интерпретация снов', description: 'Символика и архетипы', icon: '💭', postsCount: 67, createdAt: new Date().toISOString() },
  { id: 't6', name: 'Юнгианская психология', description: 'Архетипы, коллективное бессознательное', icon: '🎭', postsCount: 19, createdAt: new Date().toISOString() },
  { id: 't7', name: 'Этика и практика', description: 'Профессиональные стандарты', icon: '⚖️', postsCount: 15, createdAt: new Date().toISOString() }
];

let posts: Array<{
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  topicId: string;
  createdAt: string;
  likes: number;
  replies: number;
  views: number;
}> = [];

// Publications - Topics
router.get('/publications/topics', requireAuth, (_req, res) => {
  res.json({ topics });
});

router.post('/publications/topics', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const newTopic = {
      id: `t-${Date.now()}`,
      name: String(name),
      description: String(description),
      icon: String(icon || '💬'),
      postsCount: 0,
      createdAt: new Date().toISOString()
    };

    topics.push(newTopic);
    res.json({ topic: newTopic });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create topic' });
  }
});

// Publications - Posts
router.get('/publications/posts', requireAuth, (req, res) => {
  try {
    const topicId = req.query.topicId as string | undefined;
    let filteredPosts = posts;

    if (topicId) {
      filteredPosts = posts.filter(p => p.topicId === topicId);
    }

    // Sort by creation date (newest first)
    filteredPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ posts: filteredPosts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get posts' });
  }
});

router.post('/publications/posts', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { title, content, topicId } = req.body;
    if (!title || !content || !topicId) {
      return res.status(400).json({ error: 'Title, content and topicId are required' });
    }

    const topic = topics.find(t => t.id === topicId);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const newPost = {
      id: `p-${Date.now()}`,
      title: String(title),
      content: String(content),
      author: req.user!.email?.split('@')[0] || 'Психолог',
      authorId: req.user!.id,
      topicId: String(topicId),
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: 0,
      views: 0
    };

    posts.push(newPost);
    topic.postsCount = (topic.postsCount || 0) + 1;

    res.json({ post: newPost });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

// Legacy community routes
router.get('/community/feed', requireAuth, (_req, res) => {
  res.json({ feed: [] });
});

router.get('/community/events', requireAuth, (_req, res) => {
  res.json({ events: [] });
});

router.get('/community/courses', requireAuth, (_req, res) => {
  res.json({ courses: [] });
});

export default router;
