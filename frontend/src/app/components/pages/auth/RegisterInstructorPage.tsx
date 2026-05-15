import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Award, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { registerInstructor } from "../../../api";

export function RegisterInstructorPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"verify" | "register" | "success">("verify");
  const [instructorId, setInstructorId] = useState("");
  const [error, setError] = useState("");

  const handleVerifyId = (e: React.FormEvent) => {
    e.preventDefault();
    const value = instructorId.trim().toUpperCase();

    if (!value) {
      setError("Please enter your assigned Instructor ID.");
      return;
    }

    if (!/^I-\d{5}$/.test(value)) {
      setError("Instructor ID must follow the format I-12345.");
      return;
    }

    setInstructorId(value);
    setError("");
    setStep("register");
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await registerInstructor({
        username: instructorId,
        email: formData.get("email")?.toString() ?? "",
        password,
        password2: confirmPassword,
        first_name: formData.get("firstName")?.toString() ?? "",
        last_name: formData.get("lastName")?.toString() ?? "",
        role: "instructor",
      });
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-lg border border-neutral-200 p-8">
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
          <h1 className="text-2xl font-semibold mb-1">Instructor Registration</h1>
          <p className="text-sm text-neutral-500">
            {step === "verify" && "Enter your system-generated Instructor ID"}
            {step === "register" && "Complete your profile"}
            {step === "success" && "Registration complete!"}
          </p>
        </div>

        {step === "verify" && (
          <form onSubmit={handleVerifyId} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instructorId">Instructor ID</Label>
              <Input
                id="instructorId"
                value={instructorId}
                onChange={(event) => setInstructorId(event.target.value)}
                placeholder="I-12345"
                required
              />
              <p className="text-xs text-neutral-500">
                Enter the Instructor ID assigned to you by the system administrator.
              </p>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Verify ID
            </Button>
          </form>
        )}

        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4">
              <div className="text-sm font-medium mb-1">Instructor ID</div>
              <div className="text-lg font-semibold text-red-600">{instructorId}</div>
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" required />
            </div>

            <div className="border-t border-neutral-200 pt-4 mt-4">
              <h3 className="font-medium mb-4">Teaching Details</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="beltRank">Current Belt Rank</Label>
                  <Input id="beltRank" name="beltRank" placeholder="e.g., 3rd Dan Black Belt" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">Years of Teaching Experience</Label>
                  <Input id="yearsExperience" name="yearsExperience" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specializations">Specializations</Label>
                  <Input id="specializations" name="specializations" placeholder="e.g., Kata, Kumite, Beginners" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certifications">Certifications</Label>
                  <Textarea
                    id="certifications"
                    name="certifications"
                    placeholder="List your karate certifications and qualifications"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Complete Registration
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-4">Registration Successful!</h2>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6">
              <div className="text-sm font-medium mb-1">Your Instructor ID</div>
              <div className="text-2xl font-semibold text-red-600">{instructorId}</div>
            </div>

            <Button
              onClick={() => navigate("/auth/login")}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
