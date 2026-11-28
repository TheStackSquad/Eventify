// backend/pkg/repository/vendor/vendor_read_repo_test.go

package vendor

import "testing"

func TestBuildVendorOrder(t *testing.T) {
	cases := map[string]string{
		"rating":                          vendorOrders["rating"],
		"  RATING ":                       vendorOrders["rating"],
		"top_rated":                       vendorOrders["rating"],
		"price_asc":                       vendorOrders["price_low"],
		"latest":                          vendorOrders["newest"],
		"":                                defaultVendorOrder,
		"relevance":                       defaultVendorOrder,
		"created_at; DROP TABLE vendors":  defaultVendorOrder, // raw SQL is never accepted
		"pvs_score DESC":                  defaultVendorOrder,
		"name) --":                        defaultVendorOrder,
	}
	for input, want := range cases {
		if got := buildVendorOrder(input); got != want {
			t.Errorf("buildVendorOrder(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestEveryAliasPointsAtARealOrder(t *testing.T) {
	for alias, target := range vendorOrderAliases {
		if _, ok := vendorOrders[target]; !ok {
			t.Errorf("alias %q points at %q, which is not a sort name", alias, target)
		}
	}
}

func TestEscapeLike(t *testing.T) {
	if got := escapeLike(`100%_off\now`); got != `100\%\_off\\now` {
		t.Fatalf("escapeLike = %q", got)
	}
}