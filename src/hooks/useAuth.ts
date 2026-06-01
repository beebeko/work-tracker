import { auth } from '@/src/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ status: 'authenticated', user });
      } else {
        setState({ status: 'unauthenticated', user: null });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}
