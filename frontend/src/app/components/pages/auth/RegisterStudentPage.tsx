import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Award, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { registerStudent, verifySystemId } from "../../../api";

export function RegisterStudentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"verify" | "register" | "success">("verify");
  const [studentId, setStudentId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");

  const handleVerifyId = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredId = studentId.trim().toUpperCase();

    if (!enteredId) {
      setError("Enter the Student ID provided by your instructor.");
      return;
    }

    if (!/^S-\d{5}$/.test(enteredId)) {
      setError("Student ID must follow the format S-12345.");
      return;
    }

    try {
      await verifySystemId(enteredId);
      setStudentId(enteredId);
      setError("");
      setStep("register");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify Student ID. Please check the code.");
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
    const email = formData.get("email")?.toString() ?? "";
    const heightValue = formData.get("height")?.toString() ?? "";
    const weightValue = formData.get("weight")?.toString() ?? "";

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (heightValue && Number.isNaN(Number(heightValue))) {
      setError("Height must be a number like 170.5.");
      return;
    }

    if (weightValue && Number.isNaN(Number(weightValue))) {
      setError("Weight must be a number like 55.0.");
      return;
    }

    try {
      await registerStudent({
        student_id: studentId,
        email,
        password,
        password2: confirmPassword,
        first_name: formData.get("firstName")?.toString() ?? "",
        middle_name: formData.get("middleName")?.toString() ?? "",
        last_name: formData.get("lastName")?.toString() ?? "",
        gender: formData.get("gender")?.toString() ?? "",
        current_belt_rank: formData.get("rank")?.toString() ?? "",
        club_branch: formData.get("style")?.toString() ?? "",
        birth_date: formData.get("dateOfBirth")?.toString() ?? null,
        height: heightValue || null,
        weight: weightValue || null,
        occupation: formData.get("occupation")?.toString() ?? "",
        civil_status: formData.get("status")?.toString() ?? "",
        build: formData.get("build")?.toString() ?? "",
        complexion: formData.get("complexion")?.toString() ?? "",
        nationality: formData.get("nationality")?.toString() ?? "",
        hair_color: formData.get("hairColor")?.toString() ?? "",
        house_number: formData.get("addressNo")?.toString() ?? "",
        street: formData.get("addressStreet")?.toString() ?? "",
        city: formData.get("addressMunicipality")?.toString() ?? "",
        contact_number: formData.get("contact")?.toString() ?? "",
        emergency_name: formData.get("emergencyName")?.toString() ?? "",
        relationship: formData.get("emergencyRelationship")?.toString() ?? "",
        emergency_address: `${formData.get("emergencyAddressNo")?.toString() ?? ""} ${formData.get("emergencyAddressStreet")?.toString() ?? ""}, ${formData.get("emergencyAddressMunicipality")?.toString() ?? ""}, ${formData.get("emergencyAddressProvince")?.toString() ?? ""}`.trim(),
        emergency_contact_number: formData.get("emergencyContactNumbers")?.toString() ?? "",
        previous_club: formData.get("lastClubAttended")?.toString() ?? "",
        karate_style: formData.get("style")?.toString() ?? "",
        previous_rank: formData.get("rank")?.toString() ?? "",
        membership_type: "New",
        membership_status: "Active",
        membership_year: new Date().getFullYear(),
        membership_fee: 0.0,
      });

      setUserEmail(email);
      setError("");
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
          <h1 className="text-2xl font-semibold mb-1">Student Enrollment Form</h1>
          <p className="text-sm text-neutral-500">
            {step === "verify" && "Enter the Student ID provided by your instructor to begin enrollment."}
            {step === "register" && "Complete the required details to finish enrollment."}
            {step === "success" && "Enrollment completed successfully."}
          </p>
        </div>

        {step === "verify" && (
          <form onSubmit={handleVerifyId} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="S-12345"
                required
              />
              <p className="text-xs text-neutral-500">
                Instructors must issue this ID before a student can enroll.
              </p>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Verify Student ID
            </Button>
          </form>
        )}

        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input id="middleName" name="middleName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select id="gender" name="gender" className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100" required>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input id="addressNo" name="addressNo" placeholder="No." required />
                <Input id="addressStreet" name="addressStreet" placeholder="Street" required />
                <Input id="addressMunicipality" name="addressMunicipality" placeholder="Municipality" required />
                <Input id="addressProvince" name="addressProvince" placeholder="Province" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input id="age" name="age" type="number" min="1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input id="height" name="height" type="number" step="0.1" placeholder="e.g. 170.5" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                <Input id="contact" name="contact" type="tel" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input id="weight" name="weight" type="number" step="0.1" placeholder="e.g. 55.0" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input id="occupation" name="occupation" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="build">Build</Label>
                <Input id="build" name="build" placeholder="e.g. Athletic" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" placeholder="Single, Married" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complexion">Complexion</Label>
                <Input id="complexion" name="complexion" placeholder="Fair, Medium, Dark" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" name="nationality" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hairColor">Color of Hair</Label>
                <Input id="hairColor" name="hairColor" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastClubAttended">Last Club Attended</Label>
                <Input id="lastClubAttended" name="lastClubAttended" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="style">Style</Label>
                <Input id="style" name="style" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rank">Rank</Label>
                <Input id="rank" name="rank" required />
              </div>
              <div className="space-y-2" />
            </div>

            <div className="border-t border-neutral-200 pt-4 mt-4">
              <h3 className="font-medium mb-4">Notify In Case of Emergency</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyName">Name</Label>
                  <Input id="emergencyName" name="emergencyName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelationship">Relationship</Label>
                  <Input id="emergencyRelationship" name="emergencyRelationship" required />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Emergency Contact Address</Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input id="emergencyAddressNo" name="emergencyAddressNo" placeholder="No." required />
                  <Input id="emergencyAddressStreet" name="emergencyAddressStreet" placeholder="Street" required />
                  <Input id="emergencyAddressMunicipality" name="emergencyAddressMunicipality" placeholder="Municipality" required />
                  <Input id="emergencyAddressProvince" name="emergencyAddressProvince" placeholder="Province" required />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="emergencyContactNumbers">Contact No.(s)</Label>
                <Input id="emergencyContactNumbers" name="emergencyContactNumbers" placeholder="Phone or mobile number" required />
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 mt-4">
              <h3 className="font-medium mb-4">Membership Agreement</h3>
              <p className="text-sm text-neutral-600 leading-6">
                I agree to pay all due fees and acknowledge that I am not entitled to any discount for failure to attend classes or events. I accept that misconduct, disloyalty, or behavior that brings discredit to the organization may result in dismissal. I will do my best to participate in all martial arts activities as directed by the organization, recognizing that training carries risks.
              </p>
              <div className="flex items-start gap-3 mt-4">
                <input id="membershipConsent" type="checkbox" className="mt-1 h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500" required />
                <label htmlFor="membershipConsent" className="text-sm text-neutral-600">
                  I have read and agree to the membership terms and conditions.
                </label>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 mt-4">
              <h3 className="font-medium mb-4">Account Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Create Password</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" required />
                </div>
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Complete Enrollment
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-4">Registration Successful!</h2>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 mb-6">
              <div className="text-sm font-medium mb-1">Your Student ID</div>
              <div className="text-lg font-semibold text-red-600 mb-2">{studentId}</div>
              <div className="text-sm text-neutral-600">Email: {userEmail}</div>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-neutral-500">
                Your account has been created and the Student ID has been assigned. You may now log in with your email and password.
              </p>

              <Button
                onClick={() => navigate("/auth/login")}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Go to Login
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
