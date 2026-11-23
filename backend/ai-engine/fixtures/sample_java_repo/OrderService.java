package com.livingdocs.sample;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class OrderService {

    public List<OrderDto> findOrders(String status) {
        return List.of();
    }

    public OrderDto getOrder(Long orderId) {
        return new OrderDto(orderId, "COMPLETED");
    }

    public OrderDto create(CreateOrderRequest request) {
        return new OrderDto(100L, "PENDING");
    }

    public void cancel(Long orderId, String reason) {
        // cancellation logic
    }
}
