import type { User, UserType } from '../types'

/** Props every tab page receives from the App composition layer. */
export interface PageProps {
  user: User
  role: UserType
  /** Jump to another tab by its nav key (e.g. 'sport', 'training'). */
  onNavigate: (key: string) => void
}
