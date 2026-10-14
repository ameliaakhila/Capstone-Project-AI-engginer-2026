import tensorflow as tf
from tensorflow.keras.utils import register_keras_serializable

VIOLATION_WEIGHT = 2.0
THRESHOLD        = 0.41


@register_keras_serializable(package="zonify")
class SpatialDensityEmbedding(tf.keras.layers.Layer):
    def __init__(self, units=64, **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.dense = tf.keras.layers.Dense(units, activation="relu")

    def build(self, input_shape):
        n_features = input_shape[-1]
        self.feature_attention = tf.keras.layers.Dense(n_features, activation="sigmoid")
        self.feature_attention.build(input_shape)
        super().build(input_shape)

    def call(self, inputs, training=False):
        attention = self.feature_attention(inputs)
        weighted  = inputs * attention
        return self.dense(weighted)

    def get_config(self):
        config = super().get_config()
        config.update({"units": self.units})
        return config


@register_keras_serializable(package="zonify")
def zonasi_custom_loss(y_true, y_pred):
    epsilon = 1e-7
    y_pred  = tf.clip_by_value(y_pred, epsilon, 1.0 - epsilon)
    bce = -(y_true * tf.math.log(y_pred) +
            (1.0 - y_true) * tf.math.log(1.0 - y_pred))
    violation_mask = tf.cast(y_true == 1, tf.float32)
    weights = 1.0 + violation_mask * VIOLATION_WEIGHT
    return tf.reduce_mean(bce * weights)


class RoundedMAE(tf.keras.metrics.Metric):
    def __init__(self, threshold=THRESHOLD, name="rounded_mae", **kwargs):
        super().__init__(name=name, **kwargs)
        self.threshold = threshold
        self.total = self.add_weight(name="total", initializer="zeros")
        self.count = self.add_weight(name="count", initializer="zeros")

    def update_state(self, y_true, y_pred, sample_weight=None):
        y_pred_rounded = tf.cast(y_pred >= self.threshold, tf.float32)
        mae = tf.abs(y_true - y_pred_rounded)
        self.total.assign_add(tf.reduce_sum(mae))
        self.count.assign_add(tf.cast(tf.size(y_true), tf.float32))

    def result(self):
        return self.total / self.count

    def reset_state(self):
        self.total.assign(0.0)
        self.count.assign(0.0)
