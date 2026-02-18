describe('Chat Page', () => {
  beforeEach(() => {
    // Intercept the chat API with a default successful response
    cy.intercept('POST', '/api/chat', (req) => {
      req.reply({
        statusCode: 201,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data:{"type":"sources","data":[{"title":"Flanking","category":"condition","source":"Core Rulebook","similarity":0.92}]}',
          'data:{"type":"token","data":"**Flanking** "}',
          'data:{"type":"token","data":"gives a +2 circumstance bonus."}',
          'data:{"type":"done"}',
          '',
        ].join('\n'),
      });
    }).as('chatRequest');
  });

  it('should load the chat page from root URL', () => {
    cy.visit('/');
    cy.url().should('include', '/chat');
  });

  it('should display empty state with placeholder text', () => {
    cy.visit('/chat');
    cy.get('.empty-text').should('contain.text', 'Ask a question about Pathfinder 2e rules');
  });

  it('should display the chat header with title', () => {
    cy.visit('/chat');
    cy.get('.header-title').should('have.text', 'Pathfinder 2e Rules Chat');
  });

  it('should send a message and display user bubble', () => {
    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?');
    cy.get('app-chat-input button').click();

    // User message should appear
    cy.get('.bubble.user').should('have.length', 1);
    cy.get('.bubble.user .content').should('contain.text', 'How does flanking work?');
  });

  it('should display assistant response after sending a message', () => {
    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?');
    cy.get('app-chat-input button').click();

    cy.wait('@chatRequest');

    // Assistant message should appear
    cy.get('.bubble.assistant', { timeout: 5000 }).should('have.length', 1);
    cy.get('.bubble.assistant .content').should('contain.text', 'gives a +2 circumstance bonus');
  });

  it('should display source citations on assistant message', () => {
    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?');
    cy.get('app-chat-input button').click();

    cy.wait('@chatRequest');

    cy.get('.source-chip', { timeout: 5000 }).should('have.length', 1);
    cy.get('.source-chip').first().should('have.text', 'Flanking');
  });

  it('should show error banner on API failure', () => {
    cy.intercept('POST', '/api/chat', {
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      body: '',
    }).as('chatError');

    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?');
    cy.get('app-chat-input button').click();

    cy.get('.error-banner', { timeout: 5000 }).should('be.visible');
    cy.get('.error-banner').should('contain.text', 'Server error');
  });

  it('should clear all messages when clear button is clicked', () => {
    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?');
    cy.get('app-chat-input button').click();

    cy.wait('@chatRequest');

    // Verify messages exist
    cy.get('.bubble', { timeout: 5000 }).should('have.length.greaterThan', 0);

    // Click clear
    cy.get('.clear-btn').click();

    // Messages should be gone, empty state should return
    cy.get('.bubble').should('have.length', 0);
    cy.get('.empty-text').should('be.visible');
  });

  it('should clear input after sending a message', () => {
    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?');
    cy.get('app-chat-input button').click();

    cy.get('app-chat-input input').should('have.value', '');
  });

  it('should not send empty messages', () => {
    cy.visit('/chat');

    cy.get('app-chat-input button').should('be.disabled');
  });

  it('should submit on Enter key', () => {
    cy.visit('/chat');

    cy.get('app-chat-input input').type('How does flanking work?{enter}');

    cy.get('.bubble.user').should('have.length', 1);
  });
});
