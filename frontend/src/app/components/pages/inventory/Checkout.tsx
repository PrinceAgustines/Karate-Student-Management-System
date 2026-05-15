import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Phone, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { useAuth } from "../../../auth";
import { getCart, fetchMe, createOrder } from "../../../api";
import { useNavigate } from "react-router";

type Cart = {
  id: number;
  items: any[];
  total_price: number;
  item_count: number;
};

type UserProfile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  const [formData, setFormData] = useState({
    recipient_name: "",
    recipient_contact: "",
    customer_notes: "",
    use_profile_info: false,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cartData, profileData] = await Promise.all([
        getCart(),
        fetchMe(),
      ]);

      setCart(cartData);
      setUserProfile(profileData);

      // Pre-fill form with profile info
      if (profileData) {
        setFormData((prev) => ({
          ...prev,
          recipient_name: `${profileData.first_name} ${profileData.last_name}`.trim(),
        }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.recipient_name.trim()) {
      alert('Please enter recipient name');
      return;
    }
    if (!formData.recipient_contact.trim()) {
      alert('Please enter contact number');
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        recipient_name: formData.recipient_name,
        recipient_contact: formData.recipient_contact,
        delivery_address: 'Pickup at dojo',
        delivery_city: '',
        customer_notes: formData.customer_notes,
      });

      setCreatedOrder(order);
      setOrderPlaced(true);
    } catch (error: any) {
      alert(`Error placing order: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">Loading checkout...</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="p-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Checkout</h1>
        </div>
        <div className="text-center py-12 border border-dashed border-neutral-200 rounded-lg">
          <AlertCircle className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 mb-4">Your cart is empty</p>
          <Button onClick={() => navigate('/dashboard/shop')} className="bg-red-600 hover:bg-red-700">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  if (orderPlaced && createdOrder) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
          <h1 className="text-3xl font-bold mb-2">Order Placed Successfully!</h1>
          <p className="text-neutral-600 mb-6">Your order has been submitted for confirmation</p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4 text-left mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-600">Order Number</p>
                <p className="text-lg font-bold">#{createdOrder.order_id}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600">Status</p>
                <p className="text-lg font-bold text-yellow-600">{createdOrder.order_status}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-neutral-600">Total Amount</p>
                <p className="text-2xl font-bold text-red-600">₱{parseFloat(createdOrder.total_amount).toFixed(2)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-neutral-600 mb-2">Pickup Details</p>
              <p className="font-semibold">{createdOrder.recipient_name}</p>
              <p className="text-sm text-neutral-600">{createdOrder.recipient_contact}</p>
              <p className="text-sm text-neutral-600">Pickup at dojo</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={() => navigate('/dashboard/shop?tab=orders')}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              View My Orders
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/shop')}
              className="w-full"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="p-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-sm text-neutral-600 mt-1">Complete your order information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checkout Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Delivery Information */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Pickup Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Recipient Name *</label>
                  <Input
                    name="recipient_name"
                    value={formData.recipient_name}
                    onChange={handleInputChange}
                    placeholder="Full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Contact Number *</label>
                  <Input
                    name="recipient_contact"
                    value={formData.recipient_contact}
                    onChange={handleInputChange}
                    placeholder="09XX-XXX-XXXX"
                    required
                  />
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-sm text-neutral-600">
                  <p className="font-semibold mb-2">Pickup Only</p>
                  <p>Your items are available for pickup at the dojo. No delivery service is required.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Order Notes (Optional)</label>
                  <textarea
                    name="customer_notes"
                    value={formData.customer_notes}
                    onChange={handleInputChange}
                    placeholder="Any special requests or notes..."
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
              <h2 className="font-bold text-lg">Payment Method</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-sm mb-2">💰 Cash on Pickup</p>
                <p className="text-sm text-neutral-700">
                  Payment will be collected when you pick up your order at the dojo. Please have exact cash ready.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="space-y-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 h-12 text-base"
              >
                {submitting ? "Placing Order..." : "Place Order"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard/cart')}
                className="w-full"
                disabled={submitting}
              >
                Back to Cart
              </Button>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 space-y-4 sticky top-4">
            <h2 className="font-bold text-lg">Order Summary</h2>

            <div className="space-y-3 max-h-96 overflow-y-auto border-b pb-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.inventory_item.item_name} x{item.quantity}</span>
                  <span>₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>₱{cart.total_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span className="text-green-600">Free (Meetup)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment</span>
                <span>Cash on Pickup</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-red-600">₱{cart.total_price.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-neutral-700">
              <p className="font-semibold mb-1">📍 Pickup Location</p>
              <p>Karate Dojo - Main Branch</p>
              <p className="text-xs text-neutral-600 mt-1">Pickup available during dojo hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
