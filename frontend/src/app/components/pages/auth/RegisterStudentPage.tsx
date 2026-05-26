import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Award, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff, Info, Loader } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { registerStudent, verifySystemId } from "../../../api";

// Constants for form options
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed"];
const BUILD_OPTIONS = ["Athletic", "Average", "Slim", "Muscular", "Heavy"];
const COMPLEXION_OPTIONS = ["Fair", "Medium", "Dark", "Very Fair", "Very Dark"];
const HAIR_COLOR_OPTIONS = ["Black", "Brown", "Blonde", "Red", "Gray", "White", "Other"];
const NATIONALITIES = ["Philippines", "United States", "Canada", "United Kingdom", "Australia", "China", "Japan", "Korea", "India", "Thailand", "Other"];
const BELT_RANKS = ["White", "Yellow", "Orange", "Green", "Purple", "1st Class Purple", "Brown", "1st Class Brown", "2nd Class Brown", "Black"];
const KARATE_STYLES = ["Shotokan", "Wado-Ryu", "Goju-Ryu", "Kyokushin", "Other"];

interface FormErrors {
  [key: string]: string;
}

export function RegisterStudentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"verify" | "register" | "success">("verify");
  const [studentId, setStudentId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong" | null>(null);
  const [formStep, setFormStep] = useState(1); // For multi-section form
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Load form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("enrollment_form_data");
    if (savedData) {
      try {
        setFormData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to load saved form data", e);
      }
    }
  }, []);

  // Save form data to localStorage
  useEffect(() => {
    if (Object.keys(formData).length > 0 && step === "register") {
      localStorage.setItem("enrollment_form_data", JSON.stringify(formData));
    }
  }, [formData, step]);

  // Password strength checker
  const checkPasswordStrength = (password: string): "weak" | "medium" | "strong" | null => {
    if (!password) return null;
    if (password.length < 8) return "weak";
    if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)) {
      return "strong";
    }
    if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return "medium";
    }
    return "weak";
  };

  // Field validation
  const validateEmail = (email: string): string => {
    if (!email) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
    return "";
  };

  const validatePhone = (phone: string): string => {
    if (!phone) return "Phone number is required";
    if (!/^[0-9\s\-\+()]+$/.test(phone)) return "Invalid phone format";
    return "";
  };

  const validateAge = (dateOfBirth: string): string => {
    if (!dateOfBirth) return "Date of birth is required";
    const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
    if (age < 5) return "Student must be at least 5 years old";
    if (age > 120) return "Invalid date of birth";
    return "";
  };

  const validateHeight = (height: string): string => {
    if (!height) return "Height is required";
    const h = parseFloat(height);
    if (isNaN(h) || h < 50 || h > 250) return "Height must be between 50 and 250 cm";
    return "";
  };

  const validateWeight = (weight: string): string => {
    if (!weight) return "Weight is required";
    const w = parseFloat(weight);
    if (isNaN(w) || w < 10 || w > 300) return "Weight must be between 10 and 300 kg";
    return "";
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear field error on change
    setFormErrors(prev => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const handleVerifyId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const enteredId = studentId.trim().toUpperCase();

    if (!enteredId) {
      setError("Enter the Student ID provided by your instructor.");
      return;
    }

    if (!/^S-\d{5}$/.test(enteredId)) {
      setError("Student ID must follow the format S-12345.");
      return;
    }

    setIsLoading(true);
    try {
      await verifySystemId(enteredId);
      setStudentId(enteredId);
      setError("");
      setStep("register");
      setFormStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify Student ID. Please check the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      // Account & Personal Info
      if (!formData.email) newErrors.email = "Email is required";
      else if (validateEmail(formData.email)) newErrors.email = validateEmail(formData.email);
      
      if (!formData.firstName) newErrors.firstName = "First name is required";
      if (!formData.lastName) newErrors.lastName = "Last name is required";
      if (!formData.gender) newErrors.gender = "Gender is required";
      if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
      else if (validateAge(formData.dateOfBirth)) newErrors.dateOfBirth = validateAge(formData.dateOfBirth);
    } else if (step === 2) {
      // Contact & Physical Info
      if (!formData.addressNo) newErrors.addressNo = "Address number is required";
      if (!formData.addressStreet) newErrors.addressStreet = "Street is required";
      if (!formData.addressMunicipality) newErrors.addressMunicipality = "Municipality is required";
      if (!formData.contact) newErrors.contact = validatePhone(formData.contact) || "Contact is required";
      if (!formData.height) newErrors.height = validateHeight(formData.height) || "Height is required";
      else if (validateHeight(formData.height)) newErrors.height = validateHeight(formData.height);
      
      if (!formData.weight) newErrors.weight = validateWeight(formData.weight) || "Weight is required";
      else if (validateWeight(formData.weight)) newErrors.weight = validateWeight(formData.weight);
    } else if (step === 3) {
      // Karate Background & Emergency
      if (!formData.emergencyName) newErrors.emergencyName = "Emergency contact name is required";
      if (!formData.emergencyRelationship) newErrors.emergencyRelationship = "Relationship is required";
      if (!formData.emergencyContactNumbers) {
        newErrors.emergencyContactNumbers = "Emergency contact number is required";
      } else if (validatePhone(formData.emergencyContactNumbers)) {
        newErrors.emergencyContactNumbers = validatePhone(formData.emergencyContactNumbers);
      }
    } else if (step === 4) {
      // Account Setup
      if (!formData.password) newErrors.password = "Password is required";
      else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
      
      if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm password";
      else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

      if (!formData.membershipConsent) newErrors.membershipConsent = "You must agree to the membership terms";
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate final step
    if (!validateStep(4)) {
      setError("Please correct all errors before submitting.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Calculate age from date of birth
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();

      await registerStudent({
        student_id: studentId,
        email: formData.email,
        password: formData.password,
        password2: formData.confirmPassword,
        first_name: formData.firstName || "",
        middle_name: formData.middleName || "",
        last_name: formData.lastName || "",
        gender: formData.gender || "",
        current_belt_rank: formData.rank || "",
        club_branch: formData.style || "",
        birth_date: formData.dateOfBirth || null,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        occupation: formData.occupation || "",
        civil_status: formData.status || "",
        build: formData.build || "",
        complexion: formData.complexion || "",
        nationality: formData.nationality || "",
        hair_color: formData.hairColor || "",
        house_number: formData.addressNo || "",
        street: formData.addressStreet || "",
        city: formData.addressMunicipality || "",
        contact_number: formData.contact || "",
        emergency_name: formData.emergencyName || "",
        relationship: formData.emergencyRelationship || "",
        emergency_address: `${formData.emergencyAddressNo || ""} ${formData.emergencyAddressStreet || ""}, ${formData.emergencyAddressMunicipality || ""}, ${formData.emergencyAddressProvince || ""}`.trim(),
        emergency_contact_number: formData.emergencyContactNumbers || "",
        previous_club: formData.lastClubAttended || "",
        karate_style: formData.style || "",
        previous_rank: formData.rank || "",
        membership_type: "New",
        membership_status: "Active",
        membership_year: new Date().getFullYear(),
        membership_fee: 0.0,
      });

      setUserEmail(formData.email);
      setError("");
      setStep("success");
      // Clear saved form data
      localStorage.removeItem("enrollment_form_data");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg border border-neutral-200 p-6 md:p-8">
        <Link to="/auth/login">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
        </Link>

        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
            <Award className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Student Enrollment Form</h1>
          <p className="text-sm text-neutral-600">
            {step === "verify" && "Enter the Student ID provided by your instructor"}
            {step === "register" && `Complete your profile - Step ${formStep} of 4`}
            {step === "success" && "Welcome to the Karate Student Management System!"}
          </p>
        </div>

        {/* Verify Step */}
        {step === "verify" && (
          <form onSubmit={handleVerifyId} className="space-y-4 max-w-md mx-auto">
            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-base font-medium">
                Student ID <span className="text-red-600">*</span>
              </Label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="S-12345"
                disabled={isLoading}
                className="text-base"
                aria-label="Student ID"
                aria-required="true"
              />
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Instructors must issue this ID before you can enroll
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 py-2.5"
            >
              {isLoading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Student ID"
              )}
            </Button>
          </form>
        )}

        {/* Registration Form */}
        {step === "register" && (
          <>
            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex-1 flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        i <= formStep
                          ? "bg-red-600 text-white"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {i}
                    </div>
                    {i < 4 && (
                      <div
                        className={`flex-1 h-1 mx-2 ${
                          i < formStep ? "bg-red-600" : "bg-neutral-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Account</span>
                <span>Contact</span>
                <span>Background</span>
                <span>Security</span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-6">
              {/* Step 1: Account & Personal Info */}
              {formStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base font-medium">
                      Email Address <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      placeholder="you@example.com"
                      aria-label="Email address"
                      aria-required="true"
                      aria-invalid={!!formErrors.email}
                      className={formErrors.email ? "border-red-500" : ""}
                    />
                    {formErrors.email && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="font-medium">
                        First Name <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName || ""}
                        onChange={(e) => handleFieldChange("firstName", e.target.value)}
                        placeholder="John"
                        aria-required="true"
                        aria-invalid={!!formErrors.firstName}
                        className={formErrors.firstName ? "border-red-500" : ""}
                      />
                      {formErrors.firstName && (
                        <p className="text-xs text-red-600">{formErrors.firstName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="middleName" className="font-medium">
                        Middle Name
                      </Label>
                      <Input
                        id="middleName"
                        value={formData.middleName || ""}
                        onChange={(e) => handleFieldChange("middleName", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="font-medium">
                        Last Name <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName || ""}
                        onChange={(e) => handleFieldChange("lastName", e.target.value)}
                        placeholder="Doe"
                        aria-required="true"
                        aria-invalid={!!formErrors.lastName}
                        className={formErrors.lastName ? "border-red-500" : ""}
                      />
                      {formErrors.lastName && (
                        <p className="text-xs text-red-600">{formErrors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="font-medium">
                        Gender <span className="text-red-600">*</span>
                      </Label>
                      <select
                        id="gender"
                        value={formData.gender || ""}
                        onChange={(e) => handleFieldChange("gender", e.target.value)}
                        aria-required="true"
                        aria-invalid={!!formErrors.gender}
                        className={`w-full px-3 py-2 border rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition ${
                          formErrors.gender ? "border-red-500" : "border-neutral-300"
                        }`}
                      >
                        <option value="">Select gender</option>
                        {GENDER_OPTIONS.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      {formErrors.gender && (
                        <p className="text-xs text-red-600">{formErrors.gender}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth" className="font-medium">
                        Date of Birth <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth || ""}
                        onChange={(e) => handleFieldChange("dateOfBirth", e.target.value)}
                        aria-required="true"
                        aria-invalid={!!formErrors.dateOfBirth}
                        className={formErrors.dateOfBirth ? "border-red-500" : ""}
                      />
                      {formErrors.dateOfBirth && (
                        <p className="text-xs text-red-600">{formErrors.dateOfBirth}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-200 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("verify")}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => validateStep(1) && setFormStep(2)}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      Next: Contact Info
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Contact & Physical Info */}
              {formStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h3 className="font-semibold mb-4 text-neutral-900">Contact Information</h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="font-medium mb-2 block">Address <span className="text-red-600">*</span></Label>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <Input
                            placeholder="No."
                            value={formData.addressNo || ""}
                            onChange={(e) => handleFieldChange("addressNo", e.target.value)}
                            aria-label="Address number"
                            aria-invalid={!!formErrors.addressNo}
                            className={formErrors.addressNo ? "border-red-500" : ""}
                          />
                          <Input
                            placeholder="Street"
                            value={formData.addressStreet || ""}
                            onChange={(e) => handleFieldChange("addressStreet", e.target.value)}
                            aria-label="Street"
                            aria-invalid={!!formErrors.addressStreet}
                            className={formErrors.addressStreet ? "border-red-500" : ""}
                          />
                          <Input
                            placeholder="Municipality"
                            value={formData.addressMunicipality || ""}
                            onChange={(e) => handleFieldChange("addressMunicipality", e.target.value)}
                            aria-label="Municipality"
                            aria-invalid={!!formErrors.addressMunicipality}
                            className={formErrors.addressMunicipality ? "border-red-500" : ""}
                          />
                          <Input
                            placeholder="Province"
                            value={formData.addressProvince || ""}
                            onChange={(e) => handleFieldChange("addressProvince", e.target.value)}
                            aria-label="Province"
                          />
                        </div>
                        {(formErrors.addressNo || formErrors.addressStreet || formErrors.addressMunicipality) && (
                          <p className="text-xs text-red-600 mt-1">Please complete all address fields</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact" className="font-medium">
                          Phone Number <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id="contact"
                          type="tel"
                          value={formData.contact || ""}
                          onChange={(e) => handleFieldChange("contact", e.target.value)}
                          placeholder="+63 912 345 6789"
                          aria-required="true"
                          aria-invalid={!!formErrors.contact}
                          className={formErrors.contact ? "border-red-500" : ""}
                        />
                        {formErrors.contact && (
                          <p className="text-xs text-red-600">{formErrors.contact}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-neutral-200 pt-6">
                    <h3 className="font-semibold mb-4 text-neutral-900">Physical Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="height" className="font-medium">
                          Height (cm) <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id="height"
                          type="number"
                          step="0.1"
                          value={formData.height || ""}
                          onChange={(e) => handleFieldChange("height", e.target.value)}
                          placeholder="170.5"
                          aria-required="true"
                          aria-invalid={!!formErrors.height}
                          className={formErrors.height ? "border-red-500" : ""}
                        />
                        {formErrors.height && (
                          <p className="text-xs text-red-600">{formErrors.height}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight" className="font-medium">
                          Weight (kg) <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={formData.weight || ""}
                          onChange={(e) => handleFieldChange("weight", e.target.value)}
                          placeholder="70.0"
                          aria-required="true"
                          aria-invalid={!!formErrors.weight}
                          className={formErrors.weight ? "border-red-500" : ""}
                        />
                        {formErrors.weight && (
                          <p className="text-xs text-red-600">{formErrors.weight}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="build" className="font-medium">
                          Build
                        </Label>
                        <select
                          id="build"
                          value={formData.build || ""}
                          onChange={(e) => handleFieldChange("build", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select build</option>
                          {BUILD_OPTIONS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="complexion" className="font-medium">
                          Complexion
                        </Label>
                        <select
                          id="complexion"
                          value={formData.complexion || ""}
                          onChange={(e) => handleFieldChange("complexion", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select complexion</option>
                          {COMPLEXION_OPTIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hairColor" className="font-medium">
                          Hair Color
                        </Label>
                        <select
                          id="hairColor"
                          value={formData.hairColor || ""}
                          onChange={(e) => handleFieldChange("hairColor", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select hair color</option>
                          {HAIR_COLOR_OPTIONS.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="occupation" className="font-medium">
                          Occupation
                        </Label>
                        <Input
                          id="occupation"
                          value={formData.occupation || ""}
                          onChange={(e) => handleFieldChange("occupation", e.target.value)}
                          placeholder="e.g. Student, Engineer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="nationality" className="font-medium">
                          Nationality
                        </Label>
                        <select
                          id="nationality"
                          value={formData.nationality || ""}
                          onChange={(e) => handleFieldChange("nationality", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select nationality</option>
                          {NATIONALITIES.map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status" className="font-medium">
                          Civil Status
                        </Label>
                        <select
                          id="status"
                          value={formData.status || ""}
                          onChange={(e) => handleFieldChange("status", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select status</option>
                          {CIVIL_STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-200 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormStep(1)}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => validateStep(2) && setFormStep(3)}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      Next: Background
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Karate Background & Emergency Contact */}
              {formStep === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h3 className="font-semibold mb-4 text-neutral-900">Karate Background</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="style" className="font-medium">
                          Karate Style
                        </Label>
                        <select
                          id="style"
                          value={formData.style || ""}
                          onChange={(e) => handleFieldChange("style", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select style</option>
                          {KARATE_STYLES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rank" className="font-medium">
                          Previous Rank
                        </Label>
                        <select
                          id="rank"
                          value={formData.rank || ""}
                          onChange={(e) => handleFieldChange("rank", e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                        >
                          <option value="">Select rank</option>
                          {BELT_RANKS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      <Label htmlFor="lastClubAttended" className="font-medium">
                        Last Club Attended
                      </Label>
                      <Input
                        id="lastClubAttended"
                        value={formData.lastClubAttended || ""}
                        onChange={(e) => handleFieldChange("lastClubAttended", e.target.value)}
                        placeholder="e.g. City Karate Club"
                      />
                    </div>
                  </div>

                  <div className="border-t border-neutral-200 pt-6">
                    <h3 className="font-semibold mb-4 text-neutral-900">Emergency Contact Information <span className="text-red-600">*</span></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="emergencyName" className="font-medium">
                          Contact Name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id="emergencyName"
                          value={formData.emergencyName || ""}
                          onChange={(e) => handleFieldChange("emergencyName", e.target.value)}
                          placeholder="Full name"
                          aria-required="true"
                          aria-invalid={!!formErrors.emergencyName}
                          className={formErrors.emergencyName ? "border-red-500" : ""}
                        />
                        {formErrors.emergencyName && (
                          <p className="text-xs text-red-600">{formErrors.emergencyName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergencyRelationship" className="font-medium">
                          Relationship <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id="emergencyRelationship"
                          value={formData.emergencyRelationship || ""}
                          onChange={(e) => handleFieldChange("emergencyRelationship", e.target.value)}
                          placeholder="e.g. Parent, Guardian"
                          aria-required="true"
                          aria-invalid={!!formErrors.emergencyRelationship}
                          className={formErrors.emergencyRelationship ? "border-red-500" : ""}
                        />
                        {formErrors.emergencyRelationship && (
                          <p className="text-xs text-red-600">{formErrors.emergencyRelationship}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label className="font-medium">Emergency Contact Address</Label>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <Input
                          placeholder="No."
                          value={formData.emergencyAddressNo || ""}
                          onChange={(e) => handleFieldChange("emergencyAddressNo", e.target.value)}
                        />
                        <Input
                          placeholder="Street"
                          value={formData.emergencyAddressStreet || ""}
                          onChange={(e) => handleFieldChange("emergencyAddressStreet", e.target.value)}
                        />
                        <Input
                          placeholder="Municipality"
                          value={formData.emergencyAddressMunicipality || ""}
                          onChange={(e) => handleFieldChange("emergencyAddressMunicipality", e.target.value)}
                        />
                        <Input
                          placeholder="Province"
                          value={formData.emergencyAddressProvince || ""}
                          onChange={(e) => handleFieldChange("emergencyAddressProvince", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor="emergencyContactNumbers" className="font-medium">
                        Contact Number(s) <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="emergencyContactNumbers"
                        type="tel"
                        value={formData.emergencyContactNumbers || ""}
                        onChange={(e) => handleFieldChange("emergencyContactNumbers", e.target.value)}
                        placeholder="+63 912 345 6789"
                        aria-required="true"
                        aria-invalid={!!formErrors.emergencyContactNumbers}
                        className={formErrors.emergencyContactNumbers ? "border-red-500" : ""}
                      />
                      {formErrors.emergencyContactNumbers && (
                        <p className="text-xs text-red-600">{formErrors.emergencyContactNumbers}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-200 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormStep(2)}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => validateStep(3) && setFormStep(4)}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      Next: Security
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Account Security & Membership */}
              {formStep === 4 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h3 className="font-semibold mb-4 text-neutral-900">Create Your Account</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="font-medium">
                          Create Password <span className="text-red-600">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password || ""}
                            onChange={(e) => {
                              handleFieldChange("password", e.target.value);
                              setPasswordStrength(checkPasswordStrength(e.target.value));
                            }}
                            placeholder="At least 8 characters"
                            aria-required="true"
                            aria-invalid={!!formErrors.password}
                            className={formErrors.password ? "border-red-500 pr-10" : "pr-10"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {formData.password && passwordStrength && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  passwordStrength === "weak"
                                    ? "w-1/3 bg-red-500"
                                    : passwordStrength === "medium"
                                    ? "w-2/3 bg-yellow-500"
                                    : "w-full bg-green-500"
                                }`}
                              />
                            </div>
                            <span className={`text-xs font-medium ${
                              passwordStrength === "weak"
                                ? "text-red-600"
                                : passwordStrength === "medium"
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}>
                              {passwordStrength === "weak" ? "Weak" : passwordStrength === "medium" ? "Medium" : "Strong"}
                            </span>
                          </div>
                        )}
                        {formErrors.password && (
                          <p className="text-xs text-red-600">{formErrors.password}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="font-medium">
                          Confirm Password <span className="text-red-600">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirmPassword || ""}
                            onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
                            placeholder="Re-enter password"
                            aria-required="true"
                            aria-invalid={!!formErrors.confirmPassword}
                            className={`${formErrors.confirmPassword ? "border-red-500" : ""} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {formErrors.confirmPassword && (
                          <p className="text-xs text-red-600">{formErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-neutral-200 pt-6">
                    <h3 className="font-semibold mb-4 text-neutral-900">Membership Agreement</h3>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4 max-h-40 overflow-y-auto">
                      <p className="text-sm text-neutral-700 leading-6">
                        <strong>Terms and Conditions:</strong><br/>
                        I agree to pay all due fees and acknowledge that I am not entitled to any discount for failure to attend classes or events. I accept that misconduct, disloyalty, or behavior that brings discredit to the organization may result in dismissal. I will do my best to participate in all martial arts activities as directed by the organization, recognizing that training carries inherent risks. I hereby release the organization, its instructors, and facility from any liability for injuries or damages incurred during training.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <input
                        id="membershipConsent"
                        type="checkbox"
                        checked={formData.membershipConsent || false}
                        onChange={(e) => handleFieldChange("membershipConsent", e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        aria-required="true"
                        aria-invalid={!!formErrors.membershipConsent}
                      />
                      <label htmlFor="membershipConsent" className="text-sm text-neutral-700 flex-1 cursor-pointer">
                        I have read and agree to the membership terms and conditions <span className="text-red-600">*</span>
                      </label>
                    </div>
                    {formErrors.membershipConsent && (
                      <p className="text-xs text-red-600 mt-2">{formErrors.membershipConsent}</p>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-neutral-200 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormStep(3)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 py-2.5"
                    >
                      {isLoading ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        "Complete Enrollment"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold mb-2">Enrollment Successful!</h2>
            <p className="text-neutral-600 mb-6">Welcome to our Karate Student Management System</p>

            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-6 mb-8">
              <div className="text-sm font-medium text-neutral-700 mb-2">Your Student ID</div>
              <div className="text-2xl font-bold text-red-600 mb-3 tracking-wider">{studentId}</div>
              <div className="text-sm text-neutral-600">
                <div>Email: <span className="font-medium">{userEmail}</span></div>
              </div>
            </div>

            <div className="space-y-4 max-w-md mx-auto mb-6">
              <div className="text-left border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-900 mb-2">Next Steps:</h3>
                <ul className="text-sm text-neutral-700 space-y-2">
                  <li>✓ Use your email and password to log in</li>
                  <li>✓ View your class schedule and attendance</li>
                  <li>✓ Track your belt progression progress</li>
                  <li>✓ Check your achievements and badges</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={() => navigate("/auth/login")}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 px-8 py-2.5"
            >
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
