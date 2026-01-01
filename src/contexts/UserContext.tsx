'use client';

import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';

type UserContextType = {
  user: User | null;
  isAdmin: boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  isAdmin: false,
});

export function UserProvider({
  children,
  user,
  isAdmin,
}: {
  children: React.ReactNode;
  user: User | null;
  isAdmin: boolean;
}) {
  return (
    <UserContext.Provider value={{ user, isAdmin }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
