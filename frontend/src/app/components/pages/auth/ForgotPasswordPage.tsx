import { useState } from "react";
import { Link } from "react-router";
import { Award, ArrowLeft } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg border border-neutral-200 p-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
            <Award className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-1">Reset Password</h1>
          <p className="text-sm text-neutral-500">
            {submitted
              ? "Check your email for reset instructions"
              : "Enter your email to receive reset instructions"}
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                required
              />
            </div>

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Send Reset Link
            </Button>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-neutral-600 mb-4">
              We've sent password reset instructions to your email address.
            </p>
            <Link to="/auth/login">
              <Button variant="outline" className="w-full">
                Back to Login
              </Button>
            </Link>
          </div>
        )}

        <div className="mt-6">
          <Link
            to="/auth/login"
            className="flex items-center justify-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
