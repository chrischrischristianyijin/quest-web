// Scroll Animation Handler
class ScrollAnimations {
    constructor() {
        this.sections = document.querySelectorAll('section:not(.big-title-section)');
        this.init();
    }

    init() {
        // Add intersection observer for scroll animations
        const observerOptions = {
            root: null,
            rootMargin: '-5% 0px -5% 0px',
            threshold: 0.15
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    
                    // Special handling for pipeline steps with enhanced timing
                    if (entry.target.classList.contains('pipeline-step')) {
                        // Add staggered animation for pipeline steps
                        const steps = document.querySelectorAll('.pipeline-step');
                        steps.forEach((step, index) => {
                            if (step === entry.target) {
                                setTimeout(() => {
                                    step.classList.add('visible');
                                }, index * 300);
                            }
                        });
                    }
                }
            });
        }, observerOptions);

        // Observe all sections except the hero title section
        this.sections.forEach(section => {
            observer.observe(section);
        });

        // Observe individual pipeline steps
        const pipelineSteps = document.querySelectorAll('.pipeline-step');
        pipelineSteps.forEach(step => {
            observer.observe(step);
        });

        // Add smooth scroll behavior
        this.addSmoothScroll();
    }

    addSmoothScroll() {
        // Add smooth scroll to all anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Method to trigger animations manually if needed
    triggerAnimation(sectionElement) {
        sectionElement.classList.add('visible');
    }

    // Method to reset animations
    resetAnimations() {
        this.sections.forEach(section => {
            section.classList.remove('visible');
        });
    }
}

// Initialize scroll animations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScrollAnimations();
});

// Export for potential use in other modules
export default ScrollAnimations;
