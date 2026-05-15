import { createContext, useContext, useEffect, useMemo, useState } from "react";

type UserRole = "admin" | "instructor" | "student" | "parent" | "guest";

type AuthUser = {
  id: string | null;
  role: UserRole;
  name: string;
};

type AuthState = AuthUser & {
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextValue = {
  user: AuthUser;
  login: (user: AuthUser, tokens: { access: string; refresh: string }) => void;
  logout: () => void;
  getRoleFromSystemId: (systemId: string) => UserRole;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_STORAGE_KEY = "karate-management-auth";

const initialState: AuthState = {
  id: null,
  role: "guest",
  name: "",
  accessToken: null,
  refreshToken: null,
};

function normalizeSystemId(systemId: string) {
  return systemId.trim().toUpperCase();
}

export function getRoleFromSystemId(systemId: string): UserRole {
  const id = normalizeSystemId(systemId);
  if (id.startsWith("A-") || id.startsWith("ADM") || id.startsWith("ADMIN")) {
    return "admin";
  }
  if (id.startsWith("I-") || id.startsWith("INST") || id.startsWith("INSTRUCTOR")) {
    return "instructor";
  }
  if (id.startsWith("S-") || id.startsWith("STU") || id.startsWith("STUDENT")) {
    return "student";
  }
  if (id.startsWith("P-") || id.startsWith("PAR") || id.startsWith("PARENT")) {
    return "parent";
  }
  return "guest";
}

function loadSavedAuth(): AuthState {
  if (typeof window === "undefined") {
    return initialState;
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) {
    return initialState;
  }

  try {
    const parsed = JSON.parse(raw) as AuthState;
    return {
      id: parsed.id ?? null,
      role: parsed.role ?? "guest",
      name: parsed.name ?? "",
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return initialState;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(loadSavedAuth);

  useEffect(() => {
    if (state.role === "guest") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      window.localStorage.removeItem("karate-management-access-token");
      window.localStorage.removeItem("karate-management-refresh-token");
    } else {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        id: state.id,
        role: state.role,
        name: state.name,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }));
      if (state.accessToken) {
        window.localStorage.setItem("karate-management-access-token", state.accessToken);
      }
      if (state.refreshToken) {
        window.localStorage.setItem("karate-management-refresh-token", state.refreshToken);
      }
    }
  }, [state]);

  const login = (user: AuthUser, tokens: { access: string; refresh: string }) => {
    setState({
      id: normalizeSystemId(user.id ?? ""),
      role: user.role,
      name: user.name,
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
    });
  };

  const logout = () => {
    setState(initialState);
  };

  const value = useMemo(
    () => ({ user: { id: state.id, role: state.role, name: state.name }, login, logout, getRoleFromSystemId }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
