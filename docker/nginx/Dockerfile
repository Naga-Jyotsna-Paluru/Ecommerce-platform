FROM nginx:1.27-alpine

# gettext provides envsubst — replaces ${VAR} placeholders in the template
RUN apk add --no-cache gettext

COPY nginx.template.conf /etc/nginx/nginx.template.conf

# At startup:
# 1. envsubst replaces ${PORT}, ${AUTH_SERVICE_HOST}, etc. with actual env values
#    The quoted list ensures nginx's own $variables ($host, $remote_addr, etc.)
#    are NOT substituted — only our explicit placeholders are.
# 2. nginx starts with the generated config
CMD ["sh", "-c", \
  "envsubst '${PORT} ${AUTH_SERVICE_HOST} ${AUTH_SERVICE_PORT} ${PRODUCT_SERVICE_HOST} ${PRODUCT_SERVICE_PORT} ${ORDER_SERVICE_HOST} ${ORDER_SERVICE_PORT} ${CART_SERVICE_HOST} ${CART_SERVICE_PORT} ${PAYMENT_SERVICE_HOST} ${PAYMENT_SERVICE_PORT} ${NOTIFICATION_SERVICE_HOST} ${NOTIFICATION_SERVICE_PORT}' \
  < /etc/nginx/nginx.template.conf > /etc/nginx/nginx.conf \
  && nginx -g 'daemon off;'"]
