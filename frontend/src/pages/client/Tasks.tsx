import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ClientNavbar } from '../../components/ClientNavbar';

type Task = {
  id: string;
  title: string;
  description?: string;
  type: 'dream' | 'reflection' | 'journal' | 'test' | 'other';
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  points?: number;
};

export default function ClientTasks() {
  useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    // Загружаем задачи (в реальности от ИИ)
    const saved = localStorage.getItem('client_tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch {}
    } else {
      // Демо-задачи
      const demo: Task[] = [
        { id: 't1', title: 'Запишите сегодняшний сон', description: 'Опишите сон, который вам приснился сегодня', type: 'dream', completed: false, createdAt: new Date().toISOString(), points: 10 },
        { id: 't2', title: 'Подумайте о тени', description: 'Что в вас вы не принимаете? Что вы скрываете от других?', type: 'reflection', completed: false, createdAt: new Date().toISOString(), points: 15 },
        { id: 't3', title: 'Запись в дневнике', description: 'Опишите свои эмоции и мысли за сегодня', type: 'journal', completed: true, createdAt: new Date(Date.now() - 86400000).toISOString(), points: 5 },
        { id: 't4', title: 'Пройдите тест на архетипы', description: 'Определите свой доминирующий архетип', type: 'test', completed: false, createdAt: new Date().toISOString(), points: 20 }
      ];
      setTasks(demo);
      localStorage.setItem('client_tasks', JSON.stringify(demo));
    }
  }, []);

  function toggleTask(id: string) {
    const updated = tasks.map(t => t.id === id ? {...t, completed: !t.completed} : t);
    setTasks(updated);
    localStorage.setItem('client_tasks', JSON.stringify(updated));
  }

  function getTaskIcon(type: string) {
    switch(type) {
      case 'dream': return '💭';
      case 'reflection': return '🤔';
      case 'journal': return '📔';
      case 'test': return '📝';
      default: return '✅';
    }
  }

  function handleTaskClick(task: Task) {
    if (task.type === 'dream') navigate('/dreams/new');
    else if (task.type === 'journal') navigate('/client/journal');
    else if (task.type === 'test') navigate('/client/tests');
  }

  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const totalPoints = tasks.filter(t => t.completed).reduce((sum, t) => sum + (t.points || 0), 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Ежедневные задания</h1>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Выполнено</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{completedCount}/{tasks.length}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Очки</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{totalPoints}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button 
            className={filter === 'all' ? 'button' : 'button secondary'} 
            onClick={() => setFilter('all')}
            style={{ padding: '8px 14px' }}
          >
            Все
          </button>
          <button 
            className={filter === 'active' ? 'button' : 'button secondary'} 
            onClick={() => setFilter('active')}
            style={{ padding: '8px 14px' }}
          >
            Активные
          </button>
          <button 
            className={filter === 'completed' ? 'button' : 'button secondary'} 
            onClick={() => setFilter('completed')}
            style={{ padding: '8px 14px' }}
          >
            Выполненные
          </button>
        </div>

        {/* Tasks List */}
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 600 }}>Нет заданий</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>Все задания выполнены!</div>
            </div>
          ) : (
            filtered.map(task => (
              <div key={task.id} className="card card-hover-shimmer" style={{ padding: 16, cursor: 'pointer' }} onClick={() => handleTaskClick(task)}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <div style={{ fontSize: 24 }}>{getTaskIcon(task.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.6 : 1 }}>{task.title}</div>
                      {task.points && (
                        <span className="small" style={{ background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 999 }}>+{task.points} очков</span>
                      )}
                    </div>
                    {task.description && (
                      <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{task.description}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button 
                        className={task.completed ? 'button' : 'button secondary'}
                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        {task.completed ? '✓ Выполнено' : 'Выполнить'}
                      </button>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>
                        {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

