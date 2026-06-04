package exercises

import (
	"testing"
	"time"
)

type TokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64
	lastRefill time.Time
}

func NewTokenBucket(maxTokens float64, refillRate float64) *TokenBucket {
	return &TokenBucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens += elapsed * tb.refillRate
	if tb.tokens > tb.maxTokens {
		tb.tokens = tb.maxTokens
	}
	tb.lastRefill = now
}

func (tb *TokenBucket) Allow() bool {
	tb.refill()
	if tb.tokens >= 1 {
		tb.tokens--
		return true
	}
	return false
}

func TestTokenBucketAllows(t *testing.T) {
	tb := NewTokenBucket(3, 1)
	if !tb.Allow() {
		t.Error("should allow with tokens available")
	}
}

func TestTokenBucketExhaustion(t *testing.T) {
	tb := NewTokenBucket(2, 0)
	tb.Allow()
	tb.Allow()
	if tb.Allow() {
		t.Error("should deny when tokens exhausted")
	}
}

func TestTokenBucketRefill(t *testing.T) {
	tb := NewTokenBucket(1, 1000) // 1000 tokens/sec
	tb.Allow()                     // drain
	time.Sleep(5 * time.Millisecond)
	if !tb.Allow() {
		t.Error("should allow after refill")
	}
}

func TestTokenBucketMaxCap(t *testing.T) {
	tb := NewTokenBucket(2, 1000)
	time.Sleep(10 * time.Millisecond) // would add many tokens
	tb.Allow()
	tb.Allow()
	if tb.Allow() {
		t.Error("should not exceed max capacity")
	}
}
