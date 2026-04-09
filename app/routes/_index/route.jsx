import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

const features = [
  {
    title: "Turn short-form video into sales",
    description:
      "Publish tappable product videos that feel native to your storefront and move shoppers from inspiration to checkout faster.",
  },
  {
    title: "Build widgets without code",
    description:
      "Create branded grid and slider layouts, adjust spacing and typography, and control the exact storefront experience from one dashboard.",
  },
  {
    title: "Connect every video to products",
    description:
      "Tag products inside each video so customers can discover items in context instead of hunting through collections.",
  },
];

const highlights = [
  "Shopify theme app extension for quick storefront placement",
  "Responsive video grid and slider layouts",
  "Product tagging with direct redirect links",
  "Brand styling controls for titles, buttons, spacing, and cards",
];

const setupSteps = [
  "Upload your videos and attach products inside the app.",
  "Create a widget that matches your storefront style.",
  "Add the Shoppable Video block to your Shopify theme and go live.",
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.brandLockup}>
            <img
              src="/app-logo.png"
              alt="Shoppable Video Gallery"
              className={styles.logo}
            />
            <div>
              <p className={styles.eyebrow}>Shoppable Video Gallery</p>
              <p className={styles.brandNote}>Built for Shopify storefront storytelling</p>
            </div>
          </div>

          <div className={styles.copyStack}>
            <span className={styles.pill}>Video commerce, styled for your brand</span>
            <h1 className={styles.heading}>
              Make every product video a storefront-ready shopping moment.
            </h1>
            <p className={styles.lead}>
              Shoppable Video Gallery helps merchants turn reels, tutorials, and
              product demos into interactive widgets customers can browse and shop
              directly on the store.
            </p>
          </div>

          <div className={styles.heroMeta}>
            {highlights.map((item) => (
              <div key={item} className={styles.metaItem}>
                <span className={styles.metaDot} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewBadge}>Live widget preview</span>
              <span className={styles.previewStatus}>Ready to install</span>
            </div>

            <div className={styles.previewGrid}>
              <div className={styles.previewVideoLarge}>
                <div className={styles.videoGlow} />
                <div className={styles.playButton}>Play</div>
                <div className={styles.productCard}>
                  <strong>Tagged product</strong>
                  <span>Link products directly from the video experience.</span>
                </div>
              </div>
              <div className={styles.previewColumn}>
                <div className={styles.previewTile} />
                <div className={styles.previewTileAlt} />
              </div>
            </div>

            <div className={styles.stats}>
              <div>
                <strong>Grid + slider</strong>
                <span>Flexible layouts for any page</span>
              </div>
              <div>
                <strong>Brand controls</strong>
                <span>Fonts, buttons, colors, and spacing</span>
              </div>
            </div>
          </div>

          {showForm && (
            <Form className={styles.formCard} method="post" action="/auth/login">
              <div className={styles.formIntro}>
                <p className={styles.formEyebrow}>Merchant access</p>
                <h2>Log in to manage your videos and widgets</h2>
                <p>
                  Enter your Shopify shop domain to open the admin dashboard and
                  start publishing shoppable video sections.
                </p>
              </div>

              <label className={styles.label}>
                <span>Shop domain</span>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                />
                <span className={styles.helper}>Example: your-store.myshopify.com</span>
              </label>

              <button className={styles.button} type="submit">
                Open dashboard
              </button>
            </Form>
          )}
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Why merchants use it</p>
          <h2>Designed to make video content easier to launch and easier to shop</h2>
        </div>

        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.featureCard}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.workflowCard}>
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2>Launch your video shopping experience in three steps</h2>
          <div className={styles.stepList}>
            {setupSteps.map((step, index) => (
              <div key={step} className={styles.stepItem}>
                <span className={styles.stepNumber}>0{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
