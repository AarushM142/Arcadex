import Signup from './components/Signup';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(74,222,128,0.12),_transparent_55%)]" />
      <div className="relative z-10">
        <Signup />
      </div>
    </div>
  );
}

export default App;
