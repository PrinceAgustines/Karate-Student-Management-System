import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Package, Eye, AlertCircle } from "lucide-react";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { useAuth } from "../../../auth";
import { getPendingOrders, getAllOrders, confirmOrder, completeOrder, cancelOrder } from "../../../api";

type Order = {
  order_id: number;
  user_email: string;
  order_status: string;
  recipient_name: string;
  recipient_contact: string;
  delivery_address: string;
  delivery_city: string;
  total_amount: string;
  created_at: string;
  confirmed_at?: string;
  completed_at?: string;
  confirmed_by_name?: string;
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
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    icon: Package,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

export function OrderManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [processingOrder, setProcessingOrder] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'instructor')) {
      return;
    }
    loadOrders();
  }, [user, filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = filter === 'pending'
        ? await getPendingOrders()
        : await getAllOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async (orderId: number) => {
    if (!confirm('Confirm this order? This will reduce inventory stock.')) return;

    setProcessingOrder(orderId);
    try {
      await confirmOrder(orderId);
      await loadOrders();
      alert('Order confirmed successfully!');
    } catch (error: any) {
      alert(`Error confirming order: ${error.message}`);
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleCompleteOrder = async (orderId: number) => {
    if (!confirm('Mark this order as completed? Customer has paid and picked up the items.')) return;

    setProcessingOrder(orderId);
    try {
      await completeOrder(orderId);
      await loadOrders();
      alert('Order marked as completed!');
    } catch (error: any) {
      alert(`Error completing order: ${error.message}`);
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;

    setProcessingOrder(orderId);
    try {
      await cancelOrder(orderId);
      await loadOrders();
      alert('Order cancelled successfully!');
    } catch (error: any) {
      alert(`Error cancelling order: ${error.message}`);
    } finally {
      setProcessingOrder(null);
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

  if (!user || (user.role !== 'admin' && user.role !== 'instructor')) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <p className="text-red-600">Access denied. Admin or instructor privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Manage customer orders and fulfillment
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={filter === 'pending' ? 'default' : 'ghost'}
          onClick={() => setFilter('pending')}
          className={filter === 'pending' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          <Clock className="h-4 w-4 mr-2" />
          Pending Orders ({orders.filter(o => o.order_status === 'pending').length})
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          <Package className="h-4 w-4 mr-2" />
          All Orders ({orders.length})
        </Button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-200 rounded-lg">
          <Package className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500">No orders found</p>
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
                      <p className="text-sm text-neutral-600">{order.user_email}</p>
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
                    <p className="text-xs text-neutral-500">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded">
                  <div>
                    <p className="font-semibold text-sm mb-1">Recipient</p>
                    <p className="text-sm">{order.recipient_name}</p>
                    <p className="text-sm text-neutral-600">{order.recipient_contact}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">Delivery Address</p>
                    <p className="text-sm">{order.delivery_address}</p>
                    {order.delivery_city && (
                      <p className="text-sm text-neutral-600">{order.delivery_city}</p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Items ({order.items.length})</p>
                  <div className="space-y-1">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.item_name} x{item.quantity}</span>
                        <span>₱{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-sm text-neutral-500">
                        +{order.items.length - 3} more items
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {(order.customer_notes || order.admin_notes) && (
                  <div className="space-y-2">
                    {order.customer_notes && (
                      <div className="bg-blue-50 p-3 rounded text-sm">
                        <p className="font-semibold mb-1">Customer Notes:</p>
                        <p>{order.customer_notes}</p>
                      </div>
                    )}
                    {order.admin_notes && (
                      <div className="bg-yellow-50 p-3 rounded text-sm">
                        <p className="font-semibold mb-1">Admin Notes:</p>
                        <p>{order.admin_notes}</p>
                      </div>
                    )}
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
                  {order.confirmed_by_name && (
                    <span>by {order.confirmed_by_name}</span>
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

                  {order.order_status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleConfirmOrder(order.order_id)}
                      disabled={processingOrder === order.order_id}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {processingOrder === order.order_id ? 'Confirming...' : 'Confirm Order'}
                    </Button>
                  )}

                  {order.order_status === 'confirmed' && (
                    <Button
                      size="sm"
                      onClick={() => handleCompleteOrder(order.order_id)}
                      disabled={processingOrder === order.order_id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {processingOrder === order.order_id ? 'Completing...' : 'Mark Complete'}
                    </Button>
                  )}

                  {order.order_status !== 'completed' && order.order_status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancelOrder(order.order_id)}
                      disabled={processingOrder === order.order_id}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      {processingOrder === order.order_id ? 'Cancelling...' : 'Cancel Order'}
                    </Button>
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

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span className="text-red-600">₱{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
