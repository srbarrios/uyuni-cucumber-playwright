# Copyright (c) 2024-2025 SUSE LLC.
# Licensed under the terms of the MIT license.

require 'timeout'
require_relative 'network_utils'

# The RemoteNode class represents a remote node.
# It is used to interact with the remote node through SSH.
class RemoteNode
  attr_accessor :host, :hostname, :port, :target, :fullHostname, :private_ip, :public_ip, :private_interface, :public_interface, :osFamily, :osVersion, :local_osFamily, :local_osVersion, :has_mgrctl

  # Initializes a new remote node.
  #
  # @param host [String] The hostname of the remote node.
  # @param port [Integer] The port to use for the SSH connection.
  # @return [RemoteNode] The remote node.
  def initialize(host, port: 22)
    @host = host
    @port = port
    puts "Initializing a remote node for '#{@host}'."
    raise(NotImplementedError, "Host #{@host} is not defined as a valid host in the Test Framework.") unless ENV_VAR_BY_HOST.key? @host

    unless ENV.key? ENV_VAR_BY_HOST[@host]
      warn "Host #{@host} is not defined as environment variable."
      return
    end

    @target = ENV.fetch(ENV_VAR_BY_HOST[@host], nil).to_s.strip
    # Remove /etc/motd, or any output from run will contain the content of /etc/motd
    ssh('rm -f /etc/motd && touch /etc/motd', host: @target) unless @host == 'localhost'
    out, _err, _code = ssh('echo $HOSTNAME', host: @target)
    @hostname = out.strip
    raise LoadError, "We can't connect to #{@host} through SSH." if @hostname.empty?

    $named_nodes[host] = @hostname
    if @host == 'server'
      _out, _err, code = ssh('which mgrctl', host: @target)
      @has_mgrctl = code.zero?
      # Remove /etc/motd inside the container, or any output from run will contain the content of /etc/motd
      run('rm -f /etc/motd && touch /etc/motd')
      out, _code = run('sed -n \'s/^java.hostname *= *\(.\+\)$/\1/p\' /etc/rhn/rhn.conf')
    else
      out, _err, _code = ssh('hostname -f', host: @target)
    end
    @fullHostname = out.strip
    raise StandardError, "No FQDN for '#{@hostname}'. Response code: #{code}" if @fullHostname.empty?

    $stdout.puts "Host '#{@host}' is alive with determined hostname #{@hostname} and FQDN #{@fullHostname}" unless $build_validation

    # Determine OS version and OS family both inside the container and on the local host
    # in the case of non-containerized systems, both fields will be identical:
    @osVersion, @osFamily = get_osVersion
    @local_osVersion, @local_osFamily = get_osVersion(runsInContainer: false)

    if (PRIVATE_ADDRESSES.key? host) && !$private_net.nil?
      @private_ip = net_prefix + PRIVATE_ADDRESSES[host]
      @private_interface = nil
      %w[eth1 ens4].each do |dev|
        _output, code = run_local("ip address show dev #{dev}", checkErrors: false)

        if code.zero?
          @private_interface = dev
          break
        end
      end
      raise StandardError, "No private interface for '#{@hostname}'." if @private_interface.nil?
    end

    ip = client_public_ip
    @public_ip = ip unless ip.empty?

    nodeByHost[@host] = self
    hostByNode[self] = @host
  end

  # Runs a command on the remote node.
  #
  # @param command [String] The command to run.
  # @param host [String] The hostname of the remote node.
  # @return [Array<String, String, Integer>] The exit code and the output.
  def ssh(command, host: @fullHostname)
    ssh_command(command, host, port: @port)
  end

  # Copies a file from the local machine to the remote node.
  #
  # @param local_path [String] The path to the file to be uploaded.
  # @param remote_path [String] The path in the destination.
  # @param host [String] The hostname of the remote node.
  def scp_upload(local_path, remote_path, host: @fullHostname)
    scp_upload_command(local_path, remote_path, host, port: @port)
  end

  # Copies a file from the local machine to the remote node.
  #
  # @param remote_path [String] The path of the file to be downloaded.
  # @param local_path [String] The path to the destination file.
  # @param host [String] The hostname of the remote node.
  def scp_download(remote_path, local_path, host: @fullHostname)
    scp_download_command(remote_path, local_path, host, port: @port)
  end

  # Runs a command and returns the output, error, and exit code.
  #
  # @param cmd [String] The command to run.
  # @param runsInContainer [Boolean] Whether the command should be run in the container or on the host. Defaults to true.
  # @param separated_results [Boolean] Whether the results should be stored separately. Defaults to false.
  # @param checkErrors [Boolean] Whether to check for errors or not. Defaults to true.
  # @param timeout [Integer] The timeout to be used, in seconds.
  # @param successcodes [Array<Integer>] An array with the values to be accepted as success codes from the command run.
  # @param buffer_size [Integer] The maximum buffer size in bytes.
  # @param verbose [Boolean] Whether to log the output of the command in case of success.
  # @return [Array<String, String, Integer>] The output, error, and exit code.
  def run(cmd, runsInContainer: true, separated_results: false, checkErrors: true, timeout: DEFAULT_TIMEOUT, successcodes: [0], buffer_size: 65_536, verbose: false, exec_option: '-i')
    cmd_prefixed = @has_mgrctl && runsInContainer ? "mgrctl exec #{exec_option} '#{cmd.gsub('\'', '\'"\'"\'')}'" : cmd
    run_local(cmd_prefixed, separated_results: separated_results, checkErrors: checkErrors, timeout: timeout, successcodes: successcodes, buffer_size: buffer_size, verbose: verbose)
  end

  # Runs a command locally and returns the output, error, and exit code.
  #
  # @param cmd [String] The command to run.
  # @param separated_results [Boolean] Whether the results should be stored separately.
  # @param checkErrors [Boolean] Whether to check for errors or not.
  # @param timeout [Integer] The timeout to be used, in seconds.
  # @param successcodes [Array<Integer>] An array with the values to be accepted as success codes from the command run.
  # @param buffer_size [Integer] The maximum buffer size in bytes.
  # @param verbose [Boolean] Whether to log the output of the command in case of success.
  # @return [Array<String, Integer>] The output, error, and exit code.
  def run_local(cmd, separated_results: false, checkErrors: true, timeout: DEFAULT_TIMEOUT, successcodes: [0], buffer_size: 65_536, verbose: false)
    out, err, code = ssh_command(cmd, @target, timeout: timeout, buffer_size: buffer_size)
    out_nocolor = out.gsub(/\e\[([;\d]+)?m/, '')
    raise ScriptError, "FAIL: #{cmd} returned status code = #{code}.\nOutput:\n#{out_nocolor}" if checkErrors && !successcodes.include?(code)

    $stdout.puts "#{cmd} returned status code = #{code}.\nOutput:\n'#{out_nocolor}'" if verbose
    if separated_results
      [out, err, code]
    else
      [out + err, code]
    end
  end

  # Runs a local command until it succeeds or times out.
  #
  # @param cmd [String] The command to run.
  # @param timeout [Integer] The timeout to be used, in seconds.
  # @param runsInContainer [Boolean] Whether the command should be run in the container or on the host.
  # @return [Array<String, Integer>] The result and exit code.
  def runLocalUntilOk(cmd, timeout: DEFAULT_TIMEOUT, runsInContainer: true)
    repeat_until_timeout(timeout: timeout, reportResult: true) do
      result, code = run_local(cmd, checkErrors: false, runsInContainer: runsInContainer)
      return [result, code] if code.zero?

      sleep 2
      result
    end
  end

  # Runs a command until it succeeds or times out.
  #
  # @param cmd [String] The command to run.
  # @param timeout [Integer] The timeout to be used, in seconds.
  # @param runsInContainer [Boolean] Whether the command should be run in the container or on the host.
  # @return [Array<String, Integer>] The result and exit code.
  def runUntilOk(cmd, timeout: DEFAULT_TIMEOUT, runsInContainer: true)
    repeat_until_timeout(timeout: timeout, reportResult: true) do
      result, code = run(cmd, checkErrors: false, runsInContainer: runsInContainer)
      return [result, code] if code.zero?

      sleep 2
      result
    end
  end

  # Runs a command until it fails or times out.
  #
  # @param cmd [String] The command to run.
  # @param timeout [Integer] The timeout to be used, in seconds.
  # @param runsInContainer [Boolean] Whether the command should be run in the container or on the host.
  # @return [Array<String, Integer>] The result and exit code.
  def runUntilFail(cmd, timeout: DEFAULT_TIMEOUT, runsInContainer: true)
    repeat_until_timeout(timeout: timeout, reportResult: true) do
      result, code = run(cmd, checkErrors: false, runsInContainer: runsInContainer)
      return [result, code] if code.nonzero?

      sleep 2
      result
    end
  end

  # Waits until the process is no longer running.
  #
  # @param process [String] The name of the process to wait for.
  # @return [Array<String, Integer>] The result and exit code.
  def wait_while_process_running(process)
    repeat_until_timeout(reportResult: true) do
      result, code = run("pgrep -x #{process} >/dev/null", checkErrors: false)
      return [result, code] if code.nonzero?

      sleep 2
      result
    end
  end

  # Copies a file from the test runner (aka controller) into the remote node.
  #
  # @param test_runner_file [String] The path to the file to copy.
  # @param remote_node_file [String] The path in the destination.
  # @return [Integer] The exit code.
  def inject(test_runner_file, remote_node_file)
    if @has_mgrctl
      tmp_file = File.join('/tmp/', File.basename(test_runner_file))
      success = get_target('localhost').scp_upload(test_runner_file, tmp_file, host: @fullHostname)
      if success
        _out, code = run_local("mgrctl cp #{tmp_file} server:#{remote_node_file}")
        raise ScriptError, "Failed to copy #{tmp_file} to container" unless code.zero?
      end
    else
      success = get_target('localhost').scp_upload(test_runner_file, remote_node_file, host: @fullHostname)
    end
    success
  end

  # Copies a file from the remote node into the test runner (aka controller).
  #
  # @param remote_node_file [String] The path in the destination.
  # @param test_runner_file [String] The path to the file to copy.
  # @return [Integer] The exit code.
  def extract(remote_node_file, test_runner_file)
    if @has_mgrctl
      tmp_file = File.join('/tmp/', File.basename(remote_node_file))
      _out, code = run_local("mgrctl cp server:#{remote_node_file} #{tmp_file}", verbose: false)
      raise ScriptError, "Failed to extract #{remote_node_file} from container" unless code.zero?

      success = get_target('localhost').scp_download(tmp_file, test_runner_file, host: @fullHostname)
      raise ScriptError, "Failed to extract #{tmp_file} from host" unless success

    else
      success = get_target('localhost').scp_download(remote_node_file, test_runner_file, host: @fullHostname)
    end
    success
  end

  # Check if a file exists on a node.
  # Handles checking in server container if possible.
  #
  # @param file [String] The path of the file to check.
  # @return [Boolean] Returns true if the file exists, false otherwise.
  def file_exists(file)
    if @has_mgrctl
      _out, code = run_local("mgrctl exec -- 'test -f #{file}'", checkErrors: false)
    else
      _out, _err, code = ssh("test -f #{file}")
    end
    code.zero?
  end

  # Check if a folder exists on a node.
  # Handles checking in server container if possible.
  #
  # @param file [String] The path of the folder to check.
  # @return [Boolean] Returns true if the folder exists, false otherwise.
  def folder_exists(file)
    if @has_mgrctl
      _out, code = run_local("mgrctl exec -- 'test -d #{file}'", checkErrors: false)
    else
      _out, _err, code = ssh("test -d #{file}")
    end
    code.zero?
  end

  # Delete a file on a node.
  # Handles checking in server container if possible.
  #
  # @param file [String] The path of the file to be deleted.
  # @return [Integer] The exit code of the file deletion operation.
  def file_delete(file)
    if @has_mgrctl
      _out, code = run_local("mgrctl exec -- 'rm #{file}'", checkErrors: false)
    else
      _out, _err, code = ssh("rm #{file}")
    end
    code
  end

  # Delete a folder on a node.
  # Handles checking in server container if possible.
  #
  # @param folder [String] The path of the folder to be deleted.
  # @return [Integer] The exit code of the operation.
  def folder_delete(folder)
    if @has_mgrctl
      _out, code = run_local("mgrctl exec -- 'rm -rf #{folder}'", checkErrors: false)
    else
      _out, _err, code = ssh("rm -rf #{folder}")
    end
    code
  end

  # Checks if the node is offline.
  #
  # @return [Boolean] true if the node is offline, false otherwise.
  def node_offline?
    result = run_local('echo test', timeout: 1, checkErrors: false).first
    return true if result.nil?

    result.empty?
  end

  # Wait until the node goes offline
  def wait_until_offline
    sleep 1 until node_offline?
    $stdout.puts "Node #{hostname} is offline."
  end

  # Wait until the node comes back online
  #
  # @param timeout [Integer] The maximum time to wait for the node to come online, in seconds.
  def wait_until_online(timeout: DEFAULT_TIMEOUT)
    repeat_until_timeout(timeout: timeout, reportResult: true, message: "#{hostname} did not come back online within #{timeout} seconds.") do
      break unless node_offline?

      sleep 1
    end
    $stdout.puts "Node #{hostname} is online."
  end

  private

  # Obtain the Public IP for a node
  def client_public_ip
    if @osFamily == 'macOS'
      %w[en0 en1 en2 en3 en4 en5 en6 en7].each do |dev|
        output, code = run_local("ipconfig getifaddr #{dev}", checkErrors: false)

        next unless code.zero?

        @public_interface = dev
        return '' if output.empty?

        return output.strip
      end
    else
      %w[br0 eth0 eth1 ens0 ens1 ens2 ens3 ens4 ens5 ens6 ens7].each do |dev|
        output, code = run_local("ip address show dev #{dev} | grep 'inet '", checkErrors: false)

        next unless code.zero?

        @public_interface = dev
        return '' if output.empty?

        return output.split[1].split('/').first
      end
    end
    raise ArgumentError, "Cannot resolve public ip of #{host}"
  end

  # Extract the OS version and OS family
  # We get these data decoding the values in '/etc/os-release'
  def get_osVersion(runsInContainer: true)
    osFamily_raw, code = run('grep "^ID=" /etc/os-release', runsInContainer: runsInContainer, checkErrors: false)
    osFamily_raw, code = run('sw_vers --productName', runsInContainer: runsInContainer, checkErrors: false) if code.nonzero?
    return nil, nil unless code.zero?

    osFamily = osFamily_raw.strip
    osFamily = osFamily.split('=')[1] unless osFamily == 'macOS'
    return nil, nil if osFamily.nil?

    osFamily.delete! '"'

    if osFamily == 'macOS'
      osVersion_raw, code = run('sw_vers --productVersion', runsInContainer: runsInContainer, checkErrors: false)
      return nil, nil unless code.zero?

      osVersion = osVersion_raw.strip
    else
      osVersion_raw, code = run('grep "^VERSION_ID=" /etc/os-release', runsInContainer: runsInContainer, checkErrors: false)
      return nil, nil unless code.zero?

      osVersion = osVersion_raw.strip.split('=')[1]
      return nil, nil if osVersion.nil?
    end

    osVersion.delete! '"'
    # on SLES, we need to replace the dot with '-SP'
    osVersion.gsub!('.', '-SP') if osFamily.match(/^sles/)
    $stdout.puts "Node: #{@hostname}, OS Version: #{osVersion}, Family: #{osFamily}"
    [osVersion, osFamily]
  end
end
