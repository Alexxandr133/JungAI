export type UserRole = 'psychologist' | 'client' | 'researcher' | 'admin' | 'guest';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export {
  PROFILE_TAGS,
  LANDING_TOPIC_TAGS,
  MATCH_TOPIC_TAGS,
  PROFILE_TAG_SUGGESTIONS,
  isProfileTag,
  searchProfileTags,
  type ProfileTag,
} from './profileTags';
