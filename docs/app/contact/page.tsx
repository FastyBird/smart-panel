import Icon from "@mdi/react";
import { mdiEmail, mdiForum, mdiGithub, mdiTwitter } from "@mdi/js";
import { Button } from "../_components/button";

export const metadata = {
  title: "Contact",
  description: "Get in touch with the FastyBird team",
};

export default function Contact() {
  return (
    <div className="bg-[#f5f5f7] text-black dark:bg-[#101113] dark:text-white py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold mb-8 text-center">
          Contact Us
        </h1>

        {/* Contact Methods */}
        <div className="bg-white border border-black/10 dark:bg-white/5 dark:border-white/10 rounded-xl p-6 md:p-8 mb-10 shadow-lg">
          <p className="text-lg text-black/80 dark:text-white/80 mb-8">
            Have questions about FastyBird Smart Panel? Reach out to us through
            any of these channels:
          </p>

          <div className="flex flex-col gap-y-8">
            {[
              {
                icon: mdiEmail,
                title: "Email",
                href: "mailto:hello@fastybird.com",
                label: "hello@fastybird.com",
              },
              {
                icon: mdiGithub,
                title: "GitHub",
                href: "https://github.com/fastybird/smart-panel",
                label: "github.com/fastybird/smart-panel",
              },
              {
                icon: mdiForum,
                title: "Discord",
                href: "https://discord.gg/mDU56cxY",
                label: "Join our Discord Server",
              },
              {
                icon: mdiTwitter,
                title: "X (Twitter)",
                href: "https://x.com/fastybird",
                label: "@fastybird",
              },
            ].map(({ icon, title, href, label }) => (
              <div
                key={title}
                className="flex items-start md:items-center gap-4 flex-col md:flex-row"
              >
                <div className="bg-white/20 dark:bg-white/10 p-3 rounded-lg">
                  <Icon path={icon} className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-medium mb-1">{title}</h3>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black/80 dark:text-white/80 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GitHub Contribution */}
        <div className="bg-white border border-black/10 dark:bg-white/5 dark:border-white/10 rounded-xl p-6 md:p-8 shadow-lg">
          <h2 className="text-xl font-medium mb-4">
            Open Source Contributions
          </h2>
          <p className="mb-6 text-black/80 dark:text-white/80">
            FastyBird Smart Panel is an open-source project. If you'd like to
            contribute, report issues, or suggest features, please visit our
            GitHub repository.
          </p>

          <Button
            variant="githubDynamic"
            href="https://github.com/fastybird/smart-panel"
            size="lg"
            className="px-6 py-4"
          >
            <Icon path={mdiGithub} size={1} className="mr-2" />
            Visit GitHub Repository
          </Button>
        </div>
      </div>
    </div>
  );
}
