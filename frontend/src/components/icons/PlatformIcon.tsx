import type { LucideProps } from 'lucide-react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bed,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Calendar,
  CalendarDays,
  ClipboardList,
  Clock,
  CloudMoon,
  Drama,
  Eye,
  FileText,
  Fingerprint,
  Flame,
  FlaskConical,
  Gem,
  Hammer,
  Heart,
  HeartCrack,
  Home,
  Inbox,
  LayoutDashboard,
  LibraryBig,
  LineChart,
  Lock,
  LockOpen,
  Mail,
  Medal,
  Menu,
  MessageCircle,
  MessagesSquare,
  Microscope,
  Moon,
  Orbit,
  Plus,
  Scale,
  Settings,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Target,
  Telescope,
  ThumbsUp,
  TriangleAlert,
  Trash2,
  Trophy,
  User,
  Users,
  Wrench,
  X
} from 'lucide-react';

const ICON_MAP = {
  home: Home,
  dreams: CloudMoon,
  journal: BookOpen,
  calendar: Calendar,
  bot: Bot,
  sparkles: Sparkles,
  trophy: Trophy,
  chart: BarChart3,
  users: Users,
  message: MessageCircle,
  messages: MessagesSquare,
  inbox: Inbox,
  stethoscope: Stethoscope,
  settings: Settings,
  user: User,
  check: BadgeCheck,
  wrench: Wrench,
  unlock: LockOpen,
  dashboard: LayoutDashboard,
  briefcase: Briefcase,
  library: LibraryBig,
  flask: FlaskConical,
  wand: Sparkles,
  book: BookOpen,
  hammer: Hammer,
  lineChart: LineChart,
  target: Target,
  heart: Heart,
  heartCrack: HeartCrack,
  moon: Moon,
  scale: Scale,
  brain: Brain,
  clipboard: ClipboardList,
  microscope: Microscope,
  mail: Mail,
  activity: Activity,
  flame: Flame,
  lock: Lock,
  bell: Bell,
  menu: Menu,
  close: X,
  file: FileText,
  drama: Drama,
  fingerprint: Fingerprint,
  orbit: Orbit,
  plus: Plus,
  star: Star,
  alertTriangle: TriangleAlert,
  clock: Clock,
  calendarDays: CalendarDays,
  bed: Bed,
  gem: Gem,
  sprout: Sprout,
  telescope: Telescope,
  medal: Medal,
  trash: Trash2,
  thumbsUp: ThumbsUp,
  eye: Eye
} as const;

export type PlatformIconName = keyof typeof ICON_MAP;

export function isPlatformIconName(name: string): name is PlatformIconName {
  return name in ICON_MAP;
}

export type PlatformIconProps = {
  name: PlatformIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  'aria-hidden'?: boolean;
} & Omit<LucideProps, 'ref'>;

export function PlatformIcon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  color,
  'aria-hidden': ariaHidden = true,
  ...rest
}: PlatformIconProps) {
  const Cmp = ICON_MAP[name];
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={color}
      aria-hidden={ariaHidden}
      {...rest}
    />
  );
}
