package event

import "errors"

var (
	// ErrNotEnoughStock: the tier exists but cannot cover the requested quantity.
	ErrNotEnoughStock = errors.New("not enough tickets available")
	// ErrTierUnavailable: the tier does not exist, or its event is deleted or has ended.
	ErrTierUnavailable = errors.New("ticket tier not found or event inactive")
)