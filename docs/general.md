English: LivingDocs — Design and Implementation of an AI-Assisted Self-Updating Document System for Engineering Teams

3.1.2. Vietnamese: Thiết kế và triển khai hệ thống tài liệu tự cập nhật với sự hỗ trợ của trí tuệ nhân tạo dành cho đội ngũ kỹ thuật phần mềm

(\*) 3.2. Main proposal content (including result and product)

a) Context:

Recent empirical research highlights that documentation drift is a widespread problem in software engineering. Tan et al. analyzed more than 3,000 GitHub repositories and reported that 28.9% of the most popular GitHub projects currently contain outdated code references, while 82.3% have experienced documentation drift during their development history. Furthermore, outdated documentation typically remains undetected for 4.2–4.7 years, demonstrating that documentation inconsistencies persist for extended periods without automated detection.

To address this issue, the researchers proposed DOCER, an automated tool that detects outdated code element references by comparing documentation with the evolution history of source code. DOCER successfully identifies references to removed or renamed classes, methods, and variables within README files and GitHub Wikis.

Despite these contributions, several research gaps remain.

• Limited documentation coverage. Existing approaches mainly focus on text-based documentation such as README files and GitHub Wikis. They do not support richer documentation formats including architecture diagrams, images, PDFs, or videos, which would require techniques such as Optical Character Recognition (OCR) and multimodal document understanding.

• Limited semantic understanding. Current techniques primarily detect documentation drift when code elements are deleted or renamed. They cannot identify semantic inconsistencies caused by behavioral changes, architectural refactoring, or modified relationships between software components while the referenced code elements still exist.

• Limited code-document analysis accuracy. DOCER relies mainly on regular expressions to extract code references from documentation. This approach may produce false positives, especially for comments, changelogs, and language-specific constructs. More robust parsing techniques such as Abstract Syntax Tree (AST) analysis can provide higher precision and richer structural information.

• Limited CI/CD integration and automation. Existing approaches generally require developers to execute documentation analysis manually. They are not deeply integrated into modern Continuous Integration and Continuous Deployment (CI/CD) workflows to automatically detect documentation drift immediately after source code changes occur.

These limitations indicate the need for an intelligent documentation maintenance system capable of understanding semantic code evolution, supporting multiple documentation formats, providing accurate code-document linkage, and continuously monitoring documentation within modern software development workflows.



b) ***Proposed Solutions:***

This project proposes LivingDocs, an AI-assisted documentation maintenance system designed to continuously detect and resolve documentation drift during software development.

LivingDocs integrates directly with GitHub Actions, allowing documentation verification to run automatically whenever developers create or update a Pull Request. Instead of relying solely on regular-expression matching, the system performs AST-based semantic code analysis to accurately identify modified software entities and behavioral changes. It continuously links documentation with source code and development artifacts, retrieves affected documents through Retrieval-Augmented Generation (RAG), and employs a Large Language Model (LLM) to determine whether documentation has become outdated.

To address the limitations of previous approaches, LivingDocs supports richer documentation types beyond traditional README files, enables semantic documentation drift detection, and integrates seamlessly into CI/CD pipelines through GitHub Actions for continuous verification. Rather than merely reporting inconsistencies, the system generates grounded documentation update suggestions based on verified code changes and presents them directly within the Pull Request review process.

Beyond drift detection, LivingDocs can read source code directly to automatically generate documentation from the code structure, following managed documentation templates. Whenever source code changes in a Pull Request or commit, the system automatically updates the affected documentation and produces a new version. Generated and auto-updated documentation pass through a governed workflow in which a Staff reviewer verifies the content against the source code and the selected template, and a Manager grants final approval before the documentation is published or committed. Every change is recorded in a version-controlled change log attributed to the acting role (AI, Staff, or Manager), so that any modification can be tracked, audited, and rolled back. This keeps automation fully under human control while removing most of the manual effort of writing and maintaining documentation.

By transforming documentation verification into an automated Continuous Integration activity, LivingDocs aims to reduce documentation debt, improve documentation accuracy, accelerate developer onboarding, and enhance the reliability of AI-assisted software engineering tools by ensuring that project knowledge remains synchronized with source code evolution.



c) ***Functional Requirements:***

1\. Developer (Author)

Account \& Authentication

• Register, log in, and log out using email/password or GitHub OAuth.

• Manage personal profile and notification preferences.

GitHub Connection

• Authorize and connect a GitHub account using GitHub OAuth.

• Review and grant the repository access scopes requested during the GitHub App installation.

• Select one or more repositories from the connected GitHub account and add them to a workspace.

• Disconnect a repository or revoke the GitHub connection at any time.

• View the connection status, default branch, and last synchronization time of each connected repository.

• Manually trigger re-synchronization of a connected repository.

• View the list of Pull Requests and commits that have been ingested from each connected repository.

• Receive a notification when a GitHub token or webhook becomes invalid and re-authorization is required.

AI Source-Code Reading \& Automatic Documentation Generation

• Request automatic documentation generation for a single file, a selected module/package, or the entire repository.

• View documentation automatically generated by AI from the source code (classes, methods, endpoints, parameters, return values, and dependencies).

• Select a documentation template to control the structure of the generated documentation.

• View the code entities that currently have no documentation (documentation coverage gaps).

• Preview AI-generated documentation before submitting it for review.

• Edit and refine AI-generated documentation drafts before submission.

• View grounding evidence for every generated document (source file path, code entity, and commit hash).

• Submit AI-generated documentation into the review and approval workflow.

• View the workflow status of submitted documentation (Draft, In Review, Approved, Rejected, Published).

Automatic Documentation Update on Source-Code Change

• When source code changes in a Pull Request or commit, the system shall automatically update the affected documentation and generate a new documentation version.

• Enable or disable automatic documentation update for a specific repository, module, or document.

• View the documentation that has been automatically updated by AI after a source-code change.

• View the code change (commit and diff) that triggered each automatic documentation update.

• Compare an AI auto-updated version against the currently published version (diff view).

• Accept, edit, or dismiss an AI auto-updated documentation version before it enters the approval workflow.

• Regenerate or re-update the documentation of a code entity on demand when needed.

• Roll back a document to the version that existed before an automatic update.

Documentation Drift Detection \& Review

• View documentation drift alerts automatically generated from Pull Requests.

• View the affected code changes together with grounding evidence (code diff, commit, and related ticket).

• View documentation drift classification (Referential, Signature, Semantic).

• View documentation drift severity (Low, Medium, High, Critical).

• Review AI-generated documentation update suggestions produced from verified code changes.

• Accept, edit, or dismiss a suggested documentation update.

• Manually trigger documentation drift analysis for a Pull Request or a specific document.

• View documentation drift history and resolution status.

Documentation Change Log \& Version History

• View the complete change history (version timeline) of a document.

• View the difference between any two versions of a document.

• For each version, view which role produced the change (AI, Staff, or Manager), the timestamp, and the trigger (commit, Pull Request, or review action).

• Restore or roll back a document to any previous version from its change log.

Knowledge Base

• Search documentation and linked code entities through the knowledge base.

• View documentation-to-code relationships and navigate between a document and its source code.

• Browse repositories, documentation collections, and available templates.

2\. Staff (Review)

• The Staff role performs the first-level review of AI-generated and auto-updated documentation before it is sent to a Manager for final approval.

• View the queue of AI-generated and auto-updated documentation pending review.

• Open a submitted document together with its grounding evidence (source file, code entity, commit, diff, and related ticket).

• View the change log of a document during revie

