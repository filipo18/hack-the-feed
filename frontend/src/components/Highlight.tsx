export function Highlight({ text, term }: { text: string; term: string }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (!term || index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
