function Server() {
  return (
    <>
      <form action="server">
        <p>Port:</p>
        <input type="text" placeholder="31337" />
        <p>Capacity:</p>
        <input type="text" placeholder="10" />
        <p>Command Char:</p>
        <input type="text" placeholder="~" />
        <button>Start Server</button>
      </form>
      <button>Shutdown Server</button>
    </>
  );
}
export default Server;
