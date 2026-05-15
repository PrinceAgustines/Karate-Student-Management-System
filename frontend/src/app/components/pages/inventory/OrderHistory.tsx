import { useEffect, useState } from "react";
import { Package, Clock, CheckCircle, XCircle, Eye, AlertCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { useNavigate } from "react-router";
import { useAuth } from "../../../auth";
import { getMyOrders } from "../../../api";

type Order = {
  order_id: number;
  order_status: string;
  recipient_name: string;
  recipient_contact: string;
  delivery_address: string;
  delivery_city: string;
  total_amount: string;
  created_at: string;
  confirmed_at?: string;
  completed_at?: string;
  admin_notes?: string;
  customer_notes?: string;
  items: Array<{
    id: number;
    item_name: string;
    quantity: number;
    price_at_order: string;
    subtotal: number;
  }>;
};

const STATUS_CONFIG = {
  pending: {
    label: "Pending - Awaiting Confirmation",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
    description: "Your order is being reviewed by our admin team.",
  },
  confirmed: {
    label: "Confirmed - Ready for Pickup",
    color: "bg-blue-100 text-blue-800",
    icon: Package,
    description: "Your order is confirmed! Please come to the dojo to pick it up.",
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
    description: "Order completed successfully. Thank you for your purchase!",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
    description: "This order has been cancelled.",
  },
};

export function OrderHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    loadOrders();
  }, [user]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <p className="text-red-600">Please log in to view your orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Track your order history and status
          </p>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-200 rounded-lg">
          <Package className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 mb-4">You haven't placed any orders yet</p>
          <Button
            onClick={() => navigate('/dashboard/shop')}
            className="bg-red-600 hover:bg-red-700"
          >
            Start Shopping
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.order_status as keyof typeof STATUS_CONFIG];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={order.order_id}
                className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">Order #{order.order_id}</h3>
                      <p className="text-sm text-neutral-600">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <Badge className={statusConfig.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">
                      ₱{parseFloat(order.total_amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Status Description */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">{statusConfig.description}</p>
                </div>

                {/* Order Items Preview */}
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Items ({order.items.length})</p>
                  <div className="space-y-1">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.item_name} x{item.quantity}</span>
                        <span>₱{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-sm text-neutral-500">
                        +{order.items.length - 2} more items
                      </p>
                    )}
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="bg-neutral-50 p-3 rounded text-sm">
                  <p className="font-semibold mb-1">Delivery Details</p>
                  <p>{order.recipient_name} • {order.recipient_contact}</p>
                  <p className="text-neutral-600">{order.delivery_address}</p>
                  {order.delivery_city && (
                    <p className="text-neutral-600">{order.delivery_city}</p>
                  )}
                </div>

                {/* Admin Notes */}
                {order.admin_notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="font-semibold text-sm mb-1">Admin Notes:</p>
                    <p className="text-sm text-yellow-800">{order.admin_notes}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex gap-4 text-xs text-neutral-500">
                  {order.confirmed_at && (
                    <span>Confirmed: {formatDate(order.confirmed_at)}</span>
                  )}
                  {order.completed_at && (
                    <span>Completed: {formatDate(order.completed_at)}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>

                  {order.order_status === 'confirmed' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex-1">
                      <p className="text-sm font-semibold text-green-800 mb-1">🎉 Ready for Pickup!</p>
                      <p className="text-xs text-green-700">
                        Please visit the dojo during operating hours to pick up your order and pay in cash.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Order #{selectedOrder.order_id} Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>

              {/* Order Status */}
              <div className="flex items-center gap-2">
                <Badge className={STATUS_CONFIG[selectedOrder.order_status as keyof typeof STATUS_CONFIG].color}>
                  {STATUS_CONFIG[selectedOrder.order_status as keyof typeof STATUS_CONFIG].label}
                </Badge>
              </div>

              {/* Order Items Detail */}
              <div className="space-y-3">
                <h3 className="font-semibold">Order Items</h3>
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-neutral-50 rounded">
                    <div>
                      <p className="font-medium">{item.item_name}</p>
                      <p className="text-sm text-neutral-600">
                        Quantity: {item.quantity} × ₱{parseFloat(item.price_at_order).toFixed(2)}
                      </p>
                    </div>
                    <p className="font-bold">₱{item.subtotal.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₱{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span className="text-green-600">Free (Meetup at Dojo)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment</span>
                  <span>Cash on Pickup</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Amount</span>
                  <span className="text-red-600">₱{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Delivery Information */}
              <div className="bg-neutral-50 p-4 rounded">
                <h3 className="font-semibold mb-2">Delivery Information</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {selectedOrder.recipient_name}</p>
                  <p><strong>Contact:</strong> {selectedOrder.recipient_contact}</p>
                  <p><strong>Address:</strong> {selectedOrder.delivery_address}</p>
                  {selectedOrder.delivery_city && (
                    <p><strong>City:</strong> {selectedOrder.delivery_city}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {(selectedOrder.customer_notes || selectedOrder.admin_notes) && (
                <div className="space-y-2">
                  {selectedOrder.customer_notes && (
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="font-semibold text-sm mb-1">Your Notes:</p>
                      <p className="text-sm">{selectedOrder.customer_notes}</p>
                    </div>
                  )}
                  {selectedOrder.admin_notes && (
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="font-semibold text-sm mb-1">Admin Notes:</p>
                      <p className="text-sm">{selectedOrder.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
