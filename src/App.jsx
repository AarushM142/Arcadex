import Signup from './components/Signup';

// This is the default component the router loads when users visit the root URL ("/")
function App() {
  return (
    // Background styling wrapper
    <div className="min-h-screen bg-background text-foreground">
      {/* Animated gradient circles running in the background */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(74,222,128,0.12),_transparent_55%)]" />

      {/* 
        This is where the actual initial content is drawn. 
        Because there is no Route Guard (if/else block) here, visiting "/" always shows the Signup page by default.
      */}
      <div className="relative z-10">
        <Signup />
      </div>
    </div>
  );
}

// Exporting the App so the Router can import it 
export default App;
