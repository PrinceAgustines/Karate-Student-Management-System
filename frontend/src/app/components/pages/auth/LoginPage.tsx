import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Award } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { useAuth, getRoleFromSystemId } from "../../../auth";
import { fetchMe, loginUser, loginParent } from "../../../api";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [systemId, setSystemId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [detectedRole, setDetectedRole] = useState<"admin" | "instructor" | "student" | "parent" | "guest">("guest");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedId = systemId.trim().toUpperCase();
    if (!normalizedId) {
      setError("Enter your system-generated ID.");
      return;
    }

    const role = getRoleFromSystemId(normalizedId);
    setDetectedRole(role);

    if (!password.trim()) {
      setError("Enter your password.");
      return;
    }

    try {
      const tokens = role === "parent"
        ? await loginParent(normalizedId, password)
        : await loginUser(normalizedId, password);

      const me = await fetchMe(tokens.access);
      const finalRole = (me.role as typeof role) || role;
      login(
        {
          id: normalizedId,
          role: finalRole,
          name: `${me.first_name || me.username || ""} ${me.last_name || ""}`.trim() || normalizedId,
        },
        { access: tokens.access, refresh: tokens.refresh },
      );
      navigate(`/dashboard/${finalRole}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg border border-neutral-200 p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
            <Award className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-1">Karate Student Management</h1>
          <p className="text-sm text-neutral-500">Sign in with your system-generated ID and password.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system-id">System ID</Label>
            <Input
              id="system-id"
              value={systemId}
              onChange={(event) => {
                const value = event.target.value;
                setSystemId(value);
                const role = getRoleFromSystemId(value);
                setDetectedRole(role);
                if (role === "parent") {
                  setPassword("");
                }
              }}
              placeholder="Enter your ID (e.g. I-12345, A-12345, S-12345, or P-12345)"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="system-password">Password</Label>
              <Link
                to="/auth/forgot-password"
                className="text-xs text-red-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="system-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {detectedRole !== "guest" && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Detected role: <span className="font-semibold text-neutral-900">{detectedRole}</span>
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-500 space-y-2">
          <div>Need an account?</div>
          <div>
            <Link to="/auth/register-instructor" className="text-red-600 hover:underline">Register as Instructor</Link>
            <span className="mx-2">|</span>
            <Link to="/auth/register-student" className="text-red-600 hover:underline">Register as Student</Link>
            <span className="mx-2">|</span>
            <Link to="/auth/register-parent" className="text-red-600 hover:underline">Register as Parent</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
