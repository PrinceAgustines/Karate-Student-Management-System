import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Award, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { registerParent } from "../../../api";

export function RegisterParentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"register" | "success">("register");
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const parentId = formData.get("parentId")?.toString().trim().toUpperCase() ?? "";
    const firstName = formData.get("firstName")?.toString() ?? "";
    const lastName = formData.get("lastName")?.toString() ?? "";
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

    if (!parentId) {
      setError("Enter your generated Parent ID.");
      return;
    }

    if (!firstName || !lastName) {
      setError("Provide both first name and last name.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Enter a password and confirm it.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await registerParent({
        username: parentId,
        email: email || parentId,
        first_name: firstName,
        last_name: lastName,
        role: "parent",
        password,
        password2: confirmPassword,
      });
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg border border-neutral-200 p-8 shadow-sm">
        <Link to="/auth/login">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
        </Link>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
            <Award className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-1">Parent Registration</h1>
          <p className="text-sm text-neutral-500">
            Use the Parent ID provided by the dojo administration to create your account.
          </p>
        </div>

        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parentId">Parent ID</Label>
              <Input id="parentId" name="parentId" placeholder="P-12345" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" type="email" placeholder="Optional email" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="Create a password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm password" required />
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Register Parent
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-4">Parent Registration Complete!</h2>
            <p className="text-sm text-neutral-500 mb-6">
              You can now log in using your Parent ID and password.
            </p>
            <Button onClick={() => navigate("/auth/login")} className="w-full bg-red-600 hover:bg-red-700">
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
