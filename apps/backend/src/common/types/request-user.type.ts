import { UserRole } from '../../../generated/prisma';

export interface RequestUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
}
