import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// next/navigation — used by AboutLayout
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// next/image — just renders an <img> so we can assert src/alt
jest.mock("next/image", () => {
  const MockImage = ({ src, alt, ...rest }) => (
    <img src={src} alt={alt} {...rest} />
  );
  MockImage.displayName = "MockImage";
  return MockImage;
});

// Section components not under test — stub them out so AboutLayout renders
// without needing their full dependency trees.
jest.mock("@/components/about/sections/aboutStats", () => {
  const AboutStats = () => <div data-testid="about-stats" />;
  AboutStats.displayName = "AboutStats";
  return AboutStats;
});
jest.mock("@/components/about/sections/aboutTrust", () => {
  const AboutTrust = () => <div data-testid="about-trust" />;
  AboutTrust.displayName = "AboutTrust";
  return AboutTrust;
});
jest.mock("@/components/about/sections/aboutPartners", () => {
  const AboutPartners = () => <div data-testid="about-partners" />;
  AboutPartners.displayName = "AboutPartners";
  return AboutPartners;
});
jest.mock("@/components/about/sections/aboutMission", () => {
  const AboutMission = () => <div data-testid="about-mission" />;
  AboutMission.displayName = "AboutMission";
  return AboutMission;
});
jest.mock("@/components/about/sections/aboutCTA", () => {
  const AboutCTA = ({ onGetStarted }) => (
    <button onClick={onGetStarted} data-testid="about-cta-btn">
      CTA Get Started
    </button>
  );
  AboutCTA.displayName = "AboutCTA";
  return AboutCTA;
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import AboutPage, { metadata } from "@/app/about-us/page";
import AboutHero from "@/components/about/sections/aboutHero";
import AboutPartnerCard from "@/components/about/sections/aboutPartnerCard";
import AboutStory from "@/components/about/sections/aboutStory";
import AboutLayout from "@/components/about/aboutLayout";

// ─── AboutPage ────────────────────────────────────────────────────────────────

describe("AboutPage (server component shell)", () => {
  it("renders the <main> wrapper", () => {
    render(<AboutPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("includes a JSON-LD script tag for structured data", () => {
    const { container } = render(<AboutPage />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).toBeInTheDocument();
  });

  it("JSON-LD contains Eventify organization name", () => {
    const { container } = render(<AboutPage />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const data = JSON.parse(script.textContent);
    expect(data.name).toBe("Eventify");
  });

  it("JSON-LD @type is Organization", () => {
    const { container } = render(<AboutPage />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const data = JSON.parse(script.textContent);
    expect(data["@type"]).toBe("Organization");
  });

  it("JSON-LD foundingDate is '2023'", () => {
    const { container } = render(<AboutPage />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const data = JSON.parse(script.textContent);
    expect(data.foundingDate).toBe("2023");
  });

  describe("metadata export", () => {
    it("exports a metadata object", () => {
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe("object");
    });

    it("title includes 'Eventify'", () => {
      expect(metadata.title).toMatch(/Eventify/);
    });

    it("canonical URL points to /about-us", () => {
      expect(metadata.alternates.canonical).toContain("/about-us");
    });

    it("openGraph locale is en_NG", () => {
      expect(metadata.openGraph.locale).toBe("en_NG");
    });

    it("robots.index and robots.follow are both true", () => {
      expect(metadata.robots.index).toBe(true);
      expect(metadata.robots.follow).toBe(true);
    });
  });
});

// ─── AboutHero ────────────────────────────────────────────────────────────────

describe("AboutHero", () => {
  it("renders the 'Welcome to Eventify' heading", () => {
    render(<AboutHero onGetStarted={jest.fn()} onLearnMore={jest.fn()} />);
    expect(
      screen.getByRole("heading", { name: /Welcome to Eventify/i }),
    ).toBeInTheDocument();
  });

  it("renders the tagline about Nigeria's premier standard", () => {
    render(<AboutHero onGetStarted={jest.fn()} onLearnMore={jest.fn()} />);
    expect(
      screen.getByText(/premier standard for everything events/i),
    ).toBeInTheDocument();
  });

  it("renders 'Get Started Free' button", () => {
    render(<AboutHero onGetStarted={jest.fn()} onLearnMore={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /Get Started Free/i }),
    ).toBeInTheDocument();
  });

  it("renders 'Learn More' button", () => {
    render(<AboutHero onGetStarted={jest.fn()} onLearnMore={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /Learn More/i }),
    ).toBeInTheDocument();
  });

  it("calls onGetStarted when 'Get Started Free' is clicked", () => {
    const onGetStarted = jest.fn();
    render(<AboutHero onGetStarted={onGetStarted} onLearnMore={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Get Started Free/i }));
    expect(onGetStarted).toHaveBeenCalledTimes(1);
  });

  it("calls onLearnMore when 'Learn More' is clicked", () => {
    const onLearnMore = jest.fn();
    render(<AboutHero onGetStarted={jest.fn()} onLearnMore={onLearnMore} />);
    fireEvent.click(screen.getByRole("button", { name: /Learn More/i }));
    expect(onLearnMore).toHaveBeenCalledTimes(1);
  });

  it("renders hero image with alt='Eventify'", () => {
    render(<AboutHero onGetStarted={jest.fn()} onLearnMore={jest.fn()} />);
    expect(screen.getByRole("img", { name: /Eventify/i })).toBeInTheDocument();
  });

  it("'Get Started Free' and 'Learn More' are separate calls", () => {
    const onGetStarted = jest.fn();
    const onLearnMore = jest.fn();
    render(<AboutHero onGetStarted={onGetStarted} onLearnMore={onLearnMore} />);
    fireEvent.click(screen.getByRole("button", { name: /Learn More/i }));
    expect(onGetStarted).not.toHaveBeenCalled();
    expect(onLearnMore).toHaveBeenCalledTimes(1);
  });
});

// ─── AboutPartnerCard ─────────────────────────────────────────────────────────

describe("AboutPartnerCard", () => {
  const MockLogo = ({ className }) => (
    <svg data-testid="partner-logo" className={className} />
  );

  it("renders the partner name", () => {
    render(<AboutPartnerCard name="Paystack" logo={MockLogo} />);
    expect(screen.getByText("Paystack")).toBeInTheDocument();
  });

  it("renders the Logo component", () => {
    render(<AboutPartnerCard name="Paystack" logo={MockLogo} />);
    expect(screen.getByTestId("partner-logo")).toBeInTheDocument();
  });

  it("applies 'simple' variant styles by default", () => {
    const { container } = render(
      <AboutPartnerCard name="Paystack" logo={MockLogo} />,
    );
    // simple variant has bg-slate-50
    expect(container.firstChild).toHaveClass("bg-slate-50");
  });

  it("applies 'bordered' variant styles when variant='bordered'", () => {
    const { container } = render(
      <AboutPartnerCard name="Hotel X" logo={MockLogo} variant="bordered" />,
    );
    expect(container.firstChild).toHaveClass("border-2");
    expect(container.firstChild).toHaveClass("border-slate-200");
  });

  it("does not apply bordered styles when using default (simple) variant", () => {
    const { container } = render(
      <AboutPartnerCard name="Paystack" logo={MockLogo} />,
    );
    expect(container.firstChild).not.toHaveClass("border-2");
  });

  it("passes className to the Logo for styling", () => {
    render(<AboutPartnerCard name="Paystack" logo={MockLogo} />);
    const logo = screen.getByTestId("partner-logo");
    // Logo should receive the transition/sizing class string
      expect(logo.getAttribute("class")).toMatch(/transition-colors/);
  });
});

// ─── AboutStory ───────────────────────────────────────────────────────────────

describe("AboutStory", () => {
  it("renders 'Spreading Fast Across Nigeria' heading", () => {
    render(<AboutStory />);
    expect(
      screen.getByRole("heading", { name: /Spreading Fast Across Nigeria/i }),
    ).toBeInTheDocument();
  });

  it("mentions Lagos and Abuja in the body copy", () => {
    render(<AboutStory />);
    expect(screen.getByText(/Lagos to Abuja/i)).toBeInTheDocument();
  });

  it("states the platform connects talent with opportunity", () => {
    render(<AboutStory />);
    expect(
      screen.getByText(/connects talent with opportunity/i),
    ).toBeInTheDocument();
  });

  it("mentions operating across all 36 Nigerian states", () => {
    render(<AboutStory />);
    expect(
      screen.getByText(/across all 36 Nigerian states/i),
    ).toBeInTheDocument();
  });

  it("renders the cultural heritage image", () => {
    render(<AboutStory />);
    expect(
      screen.getByRole("img", { name: /Eventify Cultural Heritage/i }),
    ).toBeInTheDocument();
  });

  it("renders a Globe icon wrapper (p element with bg-yellow-100)", () => {
    const { container } = render(<AboutStory />);
    // Globe is wrapped in a div > p.bg-yellow-100
    expect(container.querySelector(".bg-yellow-100")).toBeInTheDocument();
  });
});

// ─── AboutLayout ──────────────────────────────────────────────────────────────

describe("AboutLayout", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders all major section stubs", () => {
    render(<AboutLayout />);
    expect(screen.getByTestId("about-stats")).toBeInTheDocument();
    expect(screen.getByTestId("about-trust")).toBeInTheDocument();
    expect(screen.getByTestId("about-partners")).toBeInTheDocument();
    expect(screen.getByTestId("about-mission")).toBeInTheDocument();
  });

  it("renders the hero heading via AboutHero", () => {
    render(<AboutLayout />);
    expect(
      screen.getByRole("heading", { name: /Welcome to Eventify/i }),
    ).toBeInTheDocument();
  });

  it("clicking 'Get Started Free' in hero routes to create-account", () => {
    render(<AboutLayout />);
    fireEvent.click(screen.getByRole("button", { name: /Get Started Free/i }));
    expect(mockPush).toHaveBeenCalledWith("/account/auth/create-account");
  });

  it("clicking 'Learn More' in hero routes to /onboarding", () => {
    render(<AboutLayout />);
    fireEvent.click(screen.getByRole("button", { name: /Learn More/i }));
    expect(mockPush).toHaveBeenCalledWith("/onboarding");
  });

  it("clicking 'Get Started Free' in CTA also routes to create-account", () => {
    render(<AboutLayout />);
    fireEvent.click(screen.getByTestId("about-cta-btn"));
    expect(mockPush).toHaveBeenCalledWith("/account/auth/create-account");
  });

  it("hero Get Started and Learn More route to different paths", () => {
    render(<AboutLayout />);
    fireEvent.click(screen.getByRole("button", { name: /Get Started Free/i }));
    fireEvent.click(screen.getByRole("button", { name: /Learn More/i }));
    expect(mockPush).toHaveBeenNthCalledWith(1, "/account/auth/create-account");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/onboarding");
  });
});
